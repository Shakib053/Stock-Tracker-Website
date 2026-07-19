import { useEffect, useRef } from 'react'

function Modal({ isOpen, title, description, children, footer, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previous = document.activeElement
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = ''; previous?.focus?.() }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="modal-window" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div className="modal-heading">
            <div>
              <h3 id="modal-title">{title}</h3>
              {description ? <p>{description}</p> : null}
            </div>
            <button
              type="button"
              ref={closeRef}
              onClick={onClose}
              className="modal-close"
            >
              Close
            </button>
          </div>
        </div>

        <div className="modal-body">{children}</div>

        {footer ? (
          <div className="modal-footer">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

export default Modal
