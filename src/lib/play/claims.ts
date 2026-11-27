/** One Party Character as a browser sees its Claim: never by whom, only whether it is its own. */
export type ClaimRow = {
  kind: 'character' | 'draft'
  id: string
  name: string
  claim: 'yours' | 'taken' | 'free'
}
