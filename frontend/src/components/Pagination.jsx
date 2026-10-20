import { navigate } from '../utils/navigation.js'
export default function Pagination({ pagination, route }) {
  const [path, query = ''] = route.split('?')
  function page(offset) {
    const params = new URLSearchParams(query); params.set('offset', offset)
    navigate(path + '?' + params)
  }
  return <div className="pagination"><span>ข้ามแล้ว {pagination.offset} รายการ</span><div><button className="secondary" disabled={pagination.offset <= 0} onClick={() => page(Math.max(0, pagination.offset - pagination.limit))}>ก่อนหน้า</button><button className="secondary" disabled={!pagination.has_more || pagination.offset + pagination.limit > 100000} onClick={() => page(pagination.offset + pagination.limit)}>ถัดไป</button></div></div>
}