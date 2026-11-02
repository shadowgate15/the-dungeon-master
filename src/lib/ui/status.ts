export type Status = 'info' | 'success' | 'warning' | 'danger'

/** Status colour classes shared by Alert, Toast and Badge. */
export const STATUS_CLASSES: Record<Status, string> = {
  info: 'bg-info-bg text-info border-info',
  success: 'bg-success-bg text-success border-success',
  warning: 'bg-warning-bg text-warning border-warning',
  danger: 'bg-danger-bg text-danger border-danger'
}

/** Same colours with the border dropped, for compact pills. */
export const STATUS_CLASSES_BORDERLESS: Record<Status, string> = {
  info: 'bg-info-bg text-info border-transparent',
  success: 'bg-success-bg text-success border-transparent',
  warning: 'bg-warning-bg text-warning border-transparent',
  danger: 'bg-danger-bg text-danger border-transparent'
}

export const NEUTRAL_CLASSES = 'bg-raised text-text border-border'
