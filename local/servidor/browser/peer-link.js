// Ponte entre canais WebRTC e a autoridade que roda na aba.
//
// Escrito em JavaScript, e nao no TypeScript do servidor, de proposito: aqui
// nao ha regra de jogo nenhuma -- so mover bytes entre um canal de dados e um
// lugar na partida. As regras vivem inteiras no pacote compartilhado, e abrir
// o `lib` do servidor para tipos de navegador convidaria codigo de servidor a
// usar API de navegador por engano.
//
// Nao ha servidor de sinalizacao: a oferta e a resposta sao trocadas na mao,
// entre dois aparelhos que estao lado a lado. Sem STUN tambem -- numa rede
// local os candidatos de host bastam, e nao existe internet para alcancar um
// servidor STUN de qualquer forma.

const ICE_TIMEOUT_MS = 3000
/**
 * Tempo ate desistir de uma conexao que nao abre.
 *
 * Sem isto a tela dizia "conectando..." para sempre: sem servidor de
 * sinalizacao nem STUN, uma conexao que nao vai acontecer -- os aparelhos em
 * redes diferentes, por exemplo -- nao emite `failed` nenhum. Ela so nunca
 * abre, e quem esta olhando nao tem como saber a diferenca entre lento e
 * impossivel.
 */
const CONNECT_TIMEOUT_MS = 15000
const SEM_REDE = 'os dois aparelhos precisam estar na mesma rede local'

/** Vigia uma conexao e devolve a leitura do que deu errado, ou vazio. */
function watchFailure(pc, isOpen) {
  const estado = { falha: '' }

  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') estado.falha = SEM_REDE
  })
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'failed') estado.falha = SEM_REDE
  })

  return {
    armar() {
      setTimeout(() => {
        if (!estado.falha && !isOpen()) estado.falha = SEM_REDE
      }, CONNECT_TIMEOUT_MS)
    },
    ler() {
      return estado.falha
    },
  }
}
/** Frequencia com que o lugar e esvaziado para o canal. */
const PUMP_MS = 16

/** Espera a coleta de candidatos terminar, com teto. */
function gathered(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    const check = () => pc.iceGatheringState === 'complete' && done()
    pc.addEventListener('icegatheringstatechange', check)
    // Sem teto, um candidato que nunca chega trava a tela de convite.
    setTimeout(done, ICE_TIMEOUT_MS)
  })
}

/** Liga um canal de dados a um lugar na partida, nos dois sentidos. */
function bind(channel, seat) {
  channel.onmessage = (event) => seat.send(String(event.data))

  const pump = setInterval(() => {
    if (channel.readyState !== 'open') return
    for (const message of seat.drain()) channel.send(message)
  }, PUMP_MS)

  const stop = () => {
    clearInterval(pump)
    seat.leave()
  }
  channel.onclose = stop
  channel.onerror = stop
  return stop
}

/** Lado de quem hospeda: aceita convidados e da um lugar a cada um. */
export function hostSide(host) {
  const links = []
  const falhas = []

  return {
    async accept(offerJson) {
      const pc = new RTCPeerConnection({ iceServers: [] })
      const seat = host.seat()
      let aberto = false

      pc.ondatachannel = (event) => {
        aberto = true
        links.push({ pc, stop: bind(event.channel, seat) })
      }

      const vigia = watchFailure(pc, () => aberto)
      falhas.push(vigia)

      await pc.setRemoteDescription(JSON.parse(offerJson))
      await pc.setLocalDescription(await pc.createAnswer())
      await gathered(pc)
      vigia.armar()
      return JSON.stringify(pc.localDescription)
    },
    problem() {
      for (const vigia of falhas) {
        const falha = vigia.ler()
        if (falha) return falha
      }
      return ''
    },
    count() {
      return links.length
    },
    stop() {
      for (const link of links) {
        link.stop()
        link.pc.close()
      }
      links.length = 0
    },
  }
}

/** Lado de quem entra: fala com a autoridade do outro aparelho pelo canal. */
export function guestSide() {
  const pc = new RTCPeerConnection({ iceServers: [] })
  const channel = pc.createDataChannel('valen', { ordered: true })
  const inbox = []
  const vigia = watchFailure(pc, () => channel.readyState === 'open')

  channel.onmessage = (event) => inbox.push(String(event.data))

  return {
    async offer() {
      await pc.setLocalDescription(await pc.createOffer())
      await gathered(pc)
      return JSON.stringify(pc.localDescription)
    },
    async accept(answerJson) {
      await pc.setRemoteDescription(JSON.parse(answerJson))
      vigia.armar()
    },
    state() {
      return channel.readyState
    },
    problem() {
      return vigia.ler()
    },
    send(raw) {
      if (channel.readyState === 'open') channel.send(raw)
    },
    drain() {
      return inbox.splice(0, inbox.length)
    },
    stop() {
      channel.close()
      pc.close()
    },
  }
}
