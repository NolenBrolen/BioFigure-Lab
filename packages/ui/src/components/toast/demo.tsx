/*
 * Storybook helpers: the two toasts the editor will show most, "Deleted ·
 * Undo" and an export that runs in the background with a Cancel button.
 */
import { useToast } from './Toast'

export function useDemoToasts() {
  const toasts = useToast()

  function showDeleted() {
    toasts.add({
      title: 'Deleted',
      description: '2 objects',
      actionProps: { children: 'Undo', onClick: () => toasts.close() },
    })
  }

  function startExport() {
    let progress = 0
    const id = toasts.add({
      title: 'Exporting figure.png',
      description: '0%',
      timeout: 0,
      data: { progress },
      actionProps: { children: 'Cancel', onClick: () => stop() },
    })
    const timer = setInterval(() => {
      progress = Math.min(1, progress + 0.05)
      if (progress < 1) {
        toasts.update(id, {
          description: `${Math.round(progress * 100)}%`,
          data: { progress },
        })
      } else {
        clearInterval(timer)
        toasts.update(id, {
          title: 'Exported figure.png',
          description: 'Saved to Downloads',
          timeout: 5000,
          data: {},
          actionProps: undefined,
        })
      }
    }, 300)
    function stop() {
      clearInterval(timer)
      toasts.close(id)
    }
  }

  return { showDeleted, startExport }
}
