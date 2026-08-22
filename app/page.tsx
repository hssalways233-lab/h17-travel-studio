import AuthGate from '@/components/AuthGate'
import XhsRawExport from '@/components/XhsRawExport'

export default function HomePage(){
  return <><AuthGate/><XhsRawExport/></>
}
