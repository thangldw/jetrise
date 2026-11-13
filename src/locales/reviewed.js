// Complete operational messages and contextual corrections.
export const messages = {
  "Bán {aircraft}? Toàn bộ lịch của máy bay này sẽ bị gỡ.": {
    "en": "Sell {aircraft}? All flights scheduled for this aircraft will be removed.",
    "ja": "{aircraft}を売却しますか？この機体に設定した運航スケジュールはすべて削除されます。"
  },
  "Trả máy bay thuê {aircraft}? Toàn bộ lịch của máy bay này sẽ bị gỡ.": {
    "en": "Return leased aircraft {aircraft}? All flights scheduled for this aircraft will be removed.",
    "ja": "リース機{aircraft}を返却しますか？この機体に設定した運航スケジュールはすべて削除されます。"
  },
  "{0} cải thiện lợi nhuận {1}": {
    "en": "{0} increased profit by {1}",
    "ja": "{0}により利益が{1}増加"
  },
  "{0} làm giảm lợi nhuận {1}": {
    "en": "{0} reduced profit by {1}",
    "ja": "{0}により利益が{1}減少"
  },
  "Cam kết hiện tại đến ngày {day}.": {
    "en": "The current commitment lasts until day {day}.",
    "ja": "現在の最低契約期間は{day}日目までです。"
  },
  "Giờ này không còn đủ quyền: AI đang sở hữu {owned}/{capacity} lượt. Chọn giờ khác.": {
    "en": "Not enough slot rights remain for this hour. Competitor holdings / total capacity: {owned}/{capacity}. Choose another hour.",
    "ja": "この時間帯の発着枠が不足しています。競合他社が{capacity}枠中{owned}枠を保有しています。別の時間帯を選んでください。"
  },
  "Đã đặt {model}. Giao đầu ngày {day}.": {
    "en": "Ordered {model}. Delivery is scheduled for the start of day {day}.",
    "ja": "{model}を発注しました。{day}日目の開始時に納入されます。"
  },
  "Quyền bị thu hồi vì không khai thác; có thể mua lại từ ngày {day}. AI có thể mua trong thời gian này.": {
    "en": "These slot rights were withdrawn due to non-use. You can buy them again from day {day}; competitors may buy them in the meantime.",
    "ja": "未使用のため発着枠が回収されました。{day}日目から再購入できますが、それまでに競合他社が購入する場合があります。"
  },
  "Đã áp dụng định vị {label}.": {
    "en": "Applied the {label} positioning strategy.",
    "ja": "事業方針を「{label}」に変更しました。"
  },
  "Đã áp dụng định vị {label}; cam kết 7 ngày khai thác, phí duy trì thu mỗi ngày.": {
    "en": "Applied the {label} positioning strategy, with a seven-operating-day commitment and a daily fee.",
    "ja": "事業方針を「{label}」に変更しました。最低契約期間は運航日7日間で、毎日維持費が発生します。"
  },
  "Chuyển tuyến · giá Y bằng {fare}% giá tham chiếu sau tuần lấp đầy {load}%.{extra}": {
    "en": "Changed route · economy fare set to {fare}% of the reference fare after a weekly load factor of {load}%.{extra}",
    "ja": "路線を変更。週間搭乗率{load}%を受け、エコノミー運賃を基準運賃の{fare}%に設定しました。{extra}"
  },
  "Giữ tuyến · giá Y bằng {fare}% giá tham chiếu sau tuần lấp đầy {load}%.{extra}": {
    "en": "Kept route · economy fare set to {fare}% of the reference fare after a weekly load factor of {load}%.{extra}",
    "ja": "路線を維持。週間搭乗率{load}%を受け、エコノミー運賃を基準運賃の{fare}%に設定しました。{extra}"
  },
  "Ngày {day}: {pax} khách · lợi nhuận {profit}. Hoàn tất {research}.": {
    "en": "Day {day} · passengers: {pax} · profit: {profit}. Completed {research}.",
    "ja": "{day}日目：旅客{pax}人・利益{profit}。{research}が完了しました。"
  },
  "{airport}: cần {needed} quyền slot vào thứ {weekday}, {hour}:00; đang có {owned}. Mua quyền theo giờ trong Thiết kế mạng trước khi sửa lịch hoặc cứu chuyến.": {
    "en": "{airport}: slot rights needed on {weekday} at {hour}:00: {needed}; currently held: {owned}. Buy hourly slot rights in Network Design before changing the schedule or recovering flights.",
    "ja": "{airport}：{weekday}{hour}:00に発着枠{needed}枠が必要ですが、保有枠は{owned}枠です。スケジュール変更や欠航回避の前に、路線網設計で時間帯別の発着枠を購入してください。"
  },
  "Số hiệu dự kiến {first}, {second}. Máy bay được chọn ngẫu nhiên khi lập hãng.": {
    "en": "Planned registrations: {first}, {second}. Aircraft models are selected at random when the airline is founded.",
    "ja": "予定登録番号：{first}、{second}。設立時に機種がランダムに選ばれます。"
  },
  "{0} · cần sửa chữa đột xuất": {
    "en": "{0} · unscheduled repair required",
    "ja": "{0}・臨時修理が必要です"
  },
  "{0}. Ca kiểm tra tuần không sửa lỗi kỹ thuật.": {
    "en": "{0}. Weekly inspections do not fix technical faults.",
    "ja": "{0}。週次点検では技術的な故障は修理されません。"
  },
  "Đã {0} riêng lượt ngày {1}. Lịch tuần giữ nguyên.": {
    "en": "Recovery applied to the day {1} flight only: {0}. The weekly schedule is unchanged.",
    "ja": "{1}日目の便のみ変更しました（{0}）。週間スケジュールは変わりません。"
  },
  "đổi sang {0}": {
    "en": "aircraft changed to {0}",
    "ja": "機体を{0}に変更"
  },
  "dời giờ khởi hành": {
    "en": "departure time changed",
    "ja": "出発時刻を変更"
  },
  "Bản dự phòng không hợp lệ: {0}": {
    "en": "Invalid backup: {0}",
    "ja": "バックアップが無効です：{0}"
  },
  "{label}: {error}": {
    "en": "{label}: {error}",
    "ja": "{label}：{error}"
  },
  "{aircraft} · đã đến hạn bảo dưỡng": {
    "en": "{aircraft} · maintenance due",
    "ja": "{aircraft}・整備期限に到達"
  },
  "{aircraft} · hạn bảo dưỡng trong 72 giờ": {
    "en": "{aircraft} · maintenance due within 72 hours",
    "ja": "{aircraft}・72時間以内に整備期限"
  },
  "{aircraft} · đang bảo dưỡng": {
    "en": "{aircraft} · under maintenance",
    "ja": "{aircraft}・整備中"
  },
  "{aircraft} · đã đặt bảo dưỡng": {
    "en": "{aircraft} · maintenance scheduled",
    "ja": "{aircraft}・整備予約済み"
  },
  "Đã đặt {0} ca bảo dưỡng tuần; phí trừ khi ca bắt đầu.": {
    "en": "Weekly maintenance shifts scheduled: {0}. Fees are charged when each shift starts.",
    "ja": "週間整備を{0}枠設定しました。費用は各整備の開始時に差し引かれます。"
  },
  "Doanh thu": {
    "en": "Revenue",
    "ja": "売上"
  },
  "Xem": {
    "en": "View",
    "ja": "表示"
  },
  "Hub cho": {
    "en": "Hub for",
    "ja": "機体の拠点"
  },
  "Kho fuel:": {
    "en": "Fuel inventory:",
    "ja": "燃料在庫："
  },
  "Mua hub ·": {
    "en": "Buy hub ·",
    "ja": "拠点を購入・"
  },
  "Fuel · $": {
    "en": "Fuel · $",
    "ja": "燃料・$"
  },
  "OPERATIONS": {
    "en": "OPERATIONS",
    "ja": "運航"
  },
  "· Hub": {
    "en": "· Hub",
    "ja": "・拠点"
  },
  "HUB": {
    "en": "HUB",
    "ja": "拠点"
  },
  "Hub": {
    "en": "Hub",
    "ja": "拠点"
  },
  "Cabin": {
    "en": "Cabin",
    "ja": "客室"
  },
  "· CABIN": {
    "en": "· CABIN",
    "ja": "・客室"
  },
  "GALLEY": {
    "en": "GALLEY",
    "ja": "ギャレー"
  },
  "WC": {
    "en": "WC",
    "ja": "トイレ"
  },
  "h": {
    "en": "h",
    "ja": "時間"
  },
  "t/6h": {
    "en": "t/6h",
    "ja": "t/6時間"
  },
  "{0} cải thiện lợi nhuận so với tuần trước {1}.": {
    "en": "{0} increased profit by {1} compared with the previous week.",
    "ja": "{0}により、前週比で利益が{1}増加しました。"
  },
  "{0} làm giảm lợi nhuận so với tuần trước {1}.": {
    "en": "{0} reduced profit by {1} compared with the previous week.",
    "ja": "{0}により、前週比で利益が{1}減少しました。"
  },
  "Giao dịch tiền đã ghi nhận · mô tả rút gọn": {
    "en": "Recorded cash movement · description shortened",
    "ja": "記録済みの資金移動（説明省略）"
  },
  "{0}/{1} máy bay sẵn sàng · {2} tuyến đã mở · {3} hub": {
    "en": "Ready aircraft: {0}/{1} · Open routes: {2} · Hubs: {3}",
    "ja": "全{1}機中{0}機が運航可能・開設済み{2}路線・{3}拠点"
  },
  "{0} · {1} vòng, lãi {2}, vốn {3}": {
    "en": "{0} · round trips: {1}, profit: {2}, cash: {3}",
    "ja": "{0}・{1}往復、利益{2}、資金{3}"
  },
  "Bán {0} vé mới, thu {1} một lần; hoàn phần chưa bay {2} và thu hồi {3} chi phí phục vụ. Hoàn vé chủ động đã chi trước chốt: {4}, không trừ lại.": {
    "en": "New tickets sold: {0}, with {1} collected once. Refunds for unflown portions: {2}; unused service costs recovered: {3}. Voluntary refunds paid before day close: {4}, not deducted again.",
    "ja": "新規販売は{0}枚で、{1}を一度だけ受け取りました。未搭乗分の払い戻しは{2}、未使用サービス費の回収は{3}です。日次確定前に任意で払い戻した{4}は、再度差し引きません。"
  },
  "{items}.": {
    "en": "{items}.",
    "ja": "{items}。"
  },
  "Kho fuel: {0} · CO₂: {1}.": {
    "en": "Fuel coverage: {0} · CO₂ coverage: {1}.",
    "ja": "燃料在庫：{0}・CO₂在庫：{1}。"
  },
  "{0} lượt khách": {
    "en": "Passenger boardings: {0}",
    "ja": "延べ搭乗者数{0}人"
  }
};
