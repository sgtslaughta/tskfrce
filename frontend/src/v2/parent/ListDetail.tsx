import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { VisuallyHidden } from '@mantine/core'

export function ListDetail({
  list,
  detail,
  listTitle,
  phone,
}: {
  list: ReactNode
  detail: ReactNode
  listTitle: ReactNode
  /** phone only: replaces list-then-detail with this strip plus the detail */
  phone?: ReactNode
}) {
  const router = useRouter()
  const small = useMediaQuery('(max-width: 767px)')
  const { item: selectedItem, ...rest } = router.query

  if (small && phone) {
    return (
      <main className="p-detail-only">
        {phone}
        <div className="p-detail-panel">{detail}</div>
      </main>
    )
  }

  if (small && selectedItem) {
    return (
      <main className="p-detail-only">
        <Link href={{ pathname: router.pathname, query: rest }} className="p-back-link">
          ← {listTitle}
        </Link>
        <div className="p-detail-panel">{detail}</div>
      </main>
    )
  }

  if (small) {
    return <main className="p-list-only">{list}</main>
  }

  return (
    <main className="p-list-detail">
      <VisuallyHidden component="h1">{listTitle}</VisuallyHidden>
      <div className="p-list-column">{list}</div>
      <div className="p-detail-column p-grid">{detail}</div>
    </main>
  )
}
