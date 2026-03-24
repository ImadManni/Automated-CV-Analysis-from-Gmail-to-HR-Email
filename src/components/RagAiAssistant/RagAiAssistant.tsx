import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiX, HiPaperAirplane } from 'react-icons/hi'
import { useAppSelector } from '@/store/hooks'
import { ragChat, ragChatWithCv } from '@/api/rag'
import styles from './RagAiAssistant.module.css'

const LOGO_SOURCES = ['/assets/PCA-FACE.png', '/assets/PCA-AVATAR.png', '/assets/PCA.png', '/pca-logo.png']

type Message = { role: 'user' | 'assistant'; content: string }

const INTRO =
  'Posez vos questions sur la plateforme, le dashboard ou PCA — en français, anglais ou darija marocaine. Si vous êtes connecté, je peux vous donner un résumé de vos candidatures.'

export function RagAiAssistant() {
  const token = useAppSelector((s) => s.auth.token)
  const [open, setOpen] = useState(false)
  const [logoIndex, setLogoIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileBase64, setFileBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const h = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const logoError = logoIndex >= LOGO_SOURCES.length

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: fileName ? `${text} (avec CV: ${fileName})` : text }])
    setLoading(true)
    try {
      let answer: string
      if (fileName && fileBase64) {
        const res = await ragChatWithCv({ message: text, fileName, fileBase64 }, token)
        answer = res.answer
      } else {
        const res = await ragChat(text, token)
        answer = res.answer
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Erreur réseau'
      setError(errMsg)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Désolé, une erreur s’est produite : ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setFileName(null)
      setFileBase64(null)
      return
    }
    if (file.type !== 'application/pdf') {
      setError('Veuillez sélectionner un fichier PDF.')
      setFileName(null)
      setFileBase64(null)
      return
    }
    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const buf = ev.target?.result
      if (!buf || !(buf instanceof ArrayBuffer)) return
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i])
      }
      const b64 = window.btoa(binary)
      setFileBase64(b64)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <motion.button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label="Ouvrir Votre AI Assistant"
        title="Votre AI Assistant — FR / EN / Darija"
        animate={reduceMotion ? {} : { scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={reduceMotion ? {} : { scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className={styles.fabGlow} aria-hidden />
        {!logoError ? (
          <img
            src={LOGO_SOURCES[logoIndex]}
            alt="Votre AI Assistant"
            className={styles.fabLogo}
            onError={() => setLogoIndex((i) => i + 1)}
          />
        ) : (
          <span className={styles.fabFallback}>PCA</span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                {!logoError ? (
                  <img
                    src={LOGO_SOURCES[logoIndex]}
                    alt=""
                    className={styles.panelLogo}
                    onError={() => setLogoIndex((i) => i + 1)}
                  />
                ) : (
                  <span className={styles.panelLogoFallback}>PCA</span>
                )}
                <span>Votre AI Assistant</span>
              </span>
              <button
                type="button"
                className={styles.panelClose}
                onClick={() => setOpen(false)}
                aria-label="Fermer"
              >
                <HiX size={24} />
              </button>
            </div>

            <div className={styles.panelBody}>
              <p className={styles.panelIntro}>{INTRO}</p>

              <div className={styles.chatList} ref={listRef}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={msg.role === 'user' ? styles.msgUser : styles.msgAssistant}
                  >
                    <span className={styles.msgContent}>{msg.content}</span>
                  </div>
                ))}
                {loading && (
                  <div className={styles.msgAssistant}>
                    <span className={styles.msgContent}>...</span>
                  </div>
                )}
              </div>

              {error && <p className={styles.chatError}>{error}</p>}

              <div className={styles.chatInputWrap}>
                <div className={styles.uploadRow}>
                  <label className={styles.uploadLabel}>
                    <span>Ajouter un CV (PDF)</span>
                    <input type="file" accept="application/pdf" onChange={handleFileChange} />
                  </label>
                  {fileName && <span className={styles.uploadFileName}>{fileName}</span>}
                </div>
                <textarea
                  className={styles.chatInput}
                  placeholder="Question (FR / EN / Darija)..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.chatSend}
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  aria-label="Envoyer"
                >
                  <HiPaperAirplane size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
