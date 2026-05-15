import Modal from './Modal'

function DeleteConfirmModal({ isOpen, stockName, isSubmitting = false, onClose, onConfirm }) {
  const footer = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="action-button border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSubmitting}
        className="action-button bg-danger text-white hover:bg-red-400"
      >
        {isSubmitting ? 'Deleting...' : 'Delete Entry'}
      </button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      title="Delete Stock Entry"
      description="This action removes the entry from your private dashboard and Firestore records."
      onClose={onClose}
      footer={footer}
    >
      <p className="text-sm leading-6 text-slate-300">
        Are you sure you want to delete <span className="font-semibold text-white">{stockName}</span>
        ? This cannot be undone.
      </p>
    </Modal>
  )
}

export default DeleteConfirmModal
