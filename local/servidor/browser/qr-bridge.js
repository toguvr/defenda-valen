// QR para a tela de convite, sem internet.
//
// O calculo acontece aqui e o desenho no Godot: devolver a matriz de modulos em
// vez de uma imagem mantem o QR nitido na resolucao da tela, do mesmo jeito que
// o resto do jogo e desenhado.
//
// Ler pela camera tambem mora aqui. Nao ha alternativa a camera para levar 647
// caracteres de um celular ao outro sem rede -- digitar esta fora de questao.

import QRCode from '../../qr/encode.js'
import jsQR from '../../qr/decode.js'

/** Nivel L: menos redundancia, QR menor. A tela esta a um palmo da camera. */
const NIVEL_L = 1
/** Quadros por segundo da leitura. Mais que isto aquece o aparelho a toa. */
const LEITURA_MS = 120

/** Matriz do QR como uma linha de 0 e 1, com o lado. */
export function matrix(text) {
  const qr = new QRCode(-1, NIVEL_L)
  qr.addData(text)
  qr.make()

  const n = qr.getModuleCount()
  let bits = ''
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) bits += qr.isDark(y, x) ? '1' : '0'
  }
  return { n, bits }
}

let leitura = null

/** Estado que o Godot le a cada quadro, sempre no mesmo lugar. */
function estado() {
  window.__valenScan = window.__valenScan || { erro: '', lido: '', ativo: 0 }
  return window.__valenScan
}

/**
 * Abre a camera e comeca a procurar um QR.
 *
 * Sincrona ate `getUserMedia` de proposito: o Safari do iOS so abre a camera
 * dentro de um gesto ainda valido, e qualquer `await` antes da chamada gasta o
 * gesto. Por isso quem chama e um `<button>` do DOM, nao o botao do Godot.
 */
export function startScan() {
  if (leitura) return true

  const st = estado()
  st.erro = ''
  st.lido = ''
  st.ativo = 1

  // O preview precisa estar visivel na pagina. Fora da tela, o Safari do iOS
  // nao decodifica quadros -- `videoWidth` fica em 0 e a leitura nunca
  // acontece. E o jogador precisa ver para onde esta apontando o aparelho.
  const camada = document.createElement('div')
  camada.style.cssText =
    'position:fixed;inset:0;z-index:60;background:#0d0f15;display:flex;' +
    'align-items:center;justify-content:center'

  const video = document.createElement('video')
  video.setAttribute('playsinline', '') // iOS abre em tela cheia sem isto
  video.muted = true
  video.autoplay = true
  video.style.cssText = 'width:100%;height:100%;object-fit:cover'
  camada.appendChild(video)

  const aviso = document.createElement('div')
  aviso.textContent = 'aponte para o codigo do outro aparelho'
  aviso.style.cssText =
    'position:absolute;left:0;right:0;top:12px;text-align:center;color:#e6e0d4;' +
    'font-family:sans-serif;font-size:14px;text-shadow:0 1px 3px #000'
  camada.appendChild(aviso)

  const cancelar = document.createElement('button')
  cancelar.textContent = 'cancelar'
  cancelar.style.cssText =
    'position:absolute;left:50%;transform:translateX(-50%);bottom:18px;' +
    'background:#1b2030;color:#e6e0d4;border:1px solid #39404f;border-radius:4px;' +
    'padding:10px 22px;font-family:sans-serif;font-size:15px'
  cancelar.addEventListener('click', stopScan)
  camada.appendChild(cancelar)

  document.body.appendChild(camada)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  leitura = { camada, video, stream: null, lido: '', timer: 0 }

  leitura.timer = setInterval(() => {
    if (!leitura || leitura.lido || video.readyState < 2) return
    if (!video.videoWidth || !video.videoHeight) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const quadro = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const achado = jsQR(quadro.data, quadro.width, quadro.height)
    if (achado) {
      leitura.lido = achado.data
      estado().lido = achado.data
    }
  }, LEITURA_MS)

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then((stream) => {
      if (!leitura) {
        for (const track of stream.getTracks()) track.stop()
        return null
      }
      leitura.stream = stream
      video.srcObject = stream
      return video.play()
    })
    .catch((e) => {
      estado().erro = String((e && e.message) || e)
      stopScan()
    })

  return true
}

/** Texto lido, ou vazio enquanto nada foi reconhecido. */
export function readScan() {
  return leitura ? leitura.lido : ''
}

export function stopScan() {
  const st = estado()
  st.lido = ''
  st.ativo = 0
  if (!leitura) return
  clearInterval(leitura.timer)
  if (leitura.stream) {
    for (const track of leitura.stream.getTracks()) track.stop()
  }
  leitura.camada.remove()
  leitura = null
}
