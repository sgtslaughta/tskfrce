import { ReactNode } from 'react'

export function ListHeader({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="p-list-header">
      <div className="p-list-header-top">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  )
}
