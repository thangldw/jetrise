// User-visible validation errors keep their canonical engine text as lookup keys.
export const messages = {
  "Invalid advance sales": {
    "en": "Invalid advance-sales data.",
    "ja": "前売り航空券のデータが無効です。"
  },
  "Invalid slot rights": {
    "en": "Invalid slot-rights data.",
    "ja": "発着枠の権利データが無効です。"
  },
  "Invalid slot right": {
    "en": "Invalid slot right.",
    "ja": "発着枠の権利が無効です。"
  },
  "Invalid leg collection": {
    "en": "Invalid flight-leg list.",
    "ja": "運航区間の一覧が無効です。"
  },
  "Invalid flight leg": {
    "en": "Invalid flight-leg data.",
    "ja": "運航区間のデータが無効です。"
  },
  "Invalid round-trip timing": {
    "en": "Invalid round-trip timing.",
    "ja": "往復便の時刻設定が無効です。"
  },
  "Invalid connection window": {
    "en": "Invalid connection time window.",
    "ja": "乗継時間の範囲が無効です。"
  },
  "Invalid booking inputs": {
    "en": "Invalid booking inputs.",
    "ja": "予約の入力データが無効です。"
  },
  "Invalid journey request": {
    "en": "Invalid journey booking request.",
    "ja": "旅程の予約リクエストが無効です。"
  },
  "Invalid itinerary": {
    "en": "Invalid itinerary.",
    "ja": "旅程が無効です。"
  },
  "Invalid connection": {
    "en": "Invalid connection.",
    "ja": "乗継が無効です。"
  },
  "Missing origin-destination demand": {
    "en": "Origin–destination demand data is missing.",
    "ja": "出発地・目的地間の需要データがありません。"
  },
  "Missing customer segment bookings": {
    "en": "Bookings by customer segment are missing.",
    "ja": "顧客層別の予約データがありません。"
  },
  "Customer ledger cursor mismatch": {
    "en": "The customer ledger's settlement date is inconsistent.",
    "ja": "顧客台帳の確定済み日付に不整合があります。"
  },
  "Invalid customer strategy": {
    "en": "Invalid customer-strategy data.",
    "ja": "顧客戦略のデータが無効です。"
  },
  "Invalid dated leg timing": {
    "en": "Invalid timing for a dated flight leg.",
    "ja": "日付指定の運航区間の時刻データが無効です。"
  },
  "Invalid dated leg timing fields": {
    "en": "Invalid time fields for a dated flight leg.",
    "ja": "日付指定の運航区間の時刻項目が無効です。"
  },
  "Invalid dated leg delay": {
    "en": "Invalid delay for a dated flight leg.",
    "ja": "日付指定の運航区間の遅延時間が無効です。"
  },
  "Invalid dated aircraft continuity": {
    "en": "The dated aircraft schedule is inconsistent.",
    "ja": "日付指定便の機体運航時刻に矛盾があります。"
  },
  "Unknown development preview": {
    "en": "Unknown development-preview type.",
    "ja": "開発プレビューの種類が不明です。"
  },
  "Invalid disruption recovery": {
    "en": "Invalid flight-recovery data.",
    "ja": "運航復旧のデータが無効です。"
  },
  "Invalid recovery exceptions": {
    "en": "Invalid list of flight-recovery exceptions.",
    "ja": "個別便の運航変更一覧が無効です。"
  },
  "Invalid recovery exception": {
    "en": "Invalid flight-recovery exception.",
    "ja": "個別便の運航変更データが無効です。"
  },
  "Missing disruption ledger": {
    "en": "The disruption ledger is missing.",
    "ja": "運航トラブルの台帳がありません。"
  },
  "tycoon schema": {
    "en": "Invalid saved operating-data structure.",
    "ja": "保存された運航データの構造が無効です。"
  },
  "tycoon slot": {
    "en": "Invalid scheduled-flight entry.",
    "ja": "運航予定のデータが無効です。"
  },
  "tycoon overlap": {
    "en": "Scheduled flights overlap for the same aircraft.",
    "ja": "同じ機体の運航予定が重複しています。"
  },
  "tycoon cabin": {
    "en": "Invalid saved cabin configuration.",
    "ja": "保存された客室構成が無効です。"
  },
  "tycoon audit": {
    "en": "Invalid saved route-date records.",
    "ja": "保存された路線別の日付記録が無効です。"
  },
  "tycoon report": {
    "en": "Invalid saved operating report.",
    "ja": "保存された運航レポートが無効です。"
  },
  "Invalid reserve designation": {
    "en": "Invalid reserve-aircraft status.",
    "ja": "機体の予備機設定が無効です。"
  },
  "Reserve aircraft cannot have recurring flights": {
    "en": "Reserve aircraft cannot have recurring flights.",
    "ja": "予備機には繰り返しの運航予定を設定できません。"
  },
  "Invalid fleet support contract": {
    "en": "Invalid fleet support contract.",
    "ja": "機材サポート契約が無効です。"
  },
  "Invalid airborne reservation": {
    "en": "Invalid in-flight aircraft timing.",
    "ja": "飛行中の機体の時刻データが無効です。"
  },
  "Invalid service due time": {
    "en": "Invalid maintenance deadline.",
    "ja": "整備期限が無効です。"
  },
  "Invalid recurring maintenance": {
    "en": "Invalid recurring maintenance schedule.",
    "ja": "定期整備の予定が無効です。"
  },
  "Invalid aircraft configuration": {
    "en": "Invalid aircraft configuration.",
    "ja": "機体の設定が無効です。"
  },
  "Invalid lease term": {
    "en": "Invalid lease term.",
    "ja": "リース期間が無効です。"
  },
  "Invalid maintenance": {
    "en": "Invalid maintenance data.",
    "ja": "整備データが無効です。"
  },
  "Invalid save": {
    "en": "Invalid save data.",
    "ja": "セーブデータが無効です。"
  },
  "Invalid economy": {
    "en": "Unsupported economy-model version.",
    "ja": "経済モデルのバージョンに対応していません。"
  },
  "Invalid airline abbreviation": {
    "en": "The airline abbreviation does not match its name.",
    "ja": "航空会社の略称が社名と一致しません。"
  },
  "Invalid setup": {
    "en": "Invalid airline setup state.",
    "ja": "航空会社の設立状態が無効です。"
  },
  "Invalid orders": {
    "en": "Invalid aircraft-order data.",
    "ja": "機体の発注データが無効です。"
  },
  "Invalid airline origin": {
    "en": "Invalid airline home airport.",
    "ja": "航空会社の拠点空港が無効です。"
  },
  "Invalid delivery hub": {
    "en": "Invalid aircraft delivery hub.",
    "ja": "機体の納入先ハブが無効です。"
  },
  "Invalid route range": {
    "en": "The route exceeds the range of all supported aircraft.",
    "ja": "路線距離が対応機材すべての航続距離を超えています。"
  },
  "Invalid fleet": {
    "en": "Invalid fleet data.",
    "ja": "機材データが無効です。"
  },
  "Invalid aircraft hub": {
    "en": "Invalid aircraft base hub.",
    "ja": "機体の配置先ハブが無効です。"
  },
  "Invalid aircraft sequence": {
    "en": "Invalid aircraft registration sequence.",
    "ja": "機体登録番号の採番データが無効です。"
  },
  "Invalid pending aircraft registration": {
    "en": "Invalid registration for an aircraft awaiting delivery.",
    "ja": "納入待ちの機体の登録番号が無効です。"
  },
  "Invalid founding stage": {
    "en": "Invalid airline founding stage.",
    "ja": "航空会社の設立段階が無効です。"
  },
  "Invalid route targets": {
    "en": "Invalid route capacity targets.",
    "ja": "路線の輸送力目標が無効です。"
  },
  "Invalid route hub": {
    "en": "Invalid route hub.",
    "ja": "路線の拠点ハブが無効です。"
  },
  "Missing schedule": {
    "en": "Flight schedule data is missing.",
    "ja": "運航スケジュールのデータがありません。"
  },
  "Invalid slot capacity": {
    "en": "The schedule exceeds slot capacity.",
    "ja": "運航予定が発着枠の上限を超えています。"
  },
  "Invalid gameplay progress": {
    "en": "Invalid gameplay progress.",
    "ja": "ゲームの進行状況データが無効です。"
  },
  "Invalid headquarters": {
    "en": "Invalid headquarters data.",
    "ja": "本部のデータが無効です。"
  },
  "Invalid maintenance expense": {
    "en": "Invalid maintenance expense.",
    "ja": "整備費用が無効です。"
  },
  "Invalid prepaid rent": {
    "en": "Invalid prepaid lease amount.",
    "ja": "前払いのリース料が無効です。"
  },
  "Invalid capacity target": {
    "en": "Invalid capacity target.",
    "ja": "輸送力目標が無効です。"
  },
  "Invalid staff": {
    "en": "Invalid staffing or training data.",
    "ja": "人員または訓練のデータが無効です。"
  },
  "Invalid ledger": {
    "en": "Invalid financial ledger.",
    "ja": "財務台帳が無効です。"
  },
  "Invalid live leg economy": {
    "en": "Invalid active per-leg economy data.",
    "ja": "適用中の区間別経済モデルのデータが無効です。"
  },
  "Live leg manifest does not reconcile": {
    "en": "The active per-leg passenger and financial data are inconsistent.",
    "ja": "適用中の区間別モデルで、乗客数または会計データに不整合があります。"
  },
  "Invalid loan": {
    "en": "Invalid loan data.",
    "ja": "借入データが無効です。"
  },
  "Invalid legacy loan": {
    "en": "Invalid legacy-format loan data.",
    "ja": "旧形式の借入データが無効です。"
  },
  "Invalid loan terms": {
    "en": "Invalid loan terms.",
    "ja": "借入条件が無効です。"
  },
  "Invalid connection program": {
    "en": "Invalid connecting-ticket program settings.",
    "ja": "乗継航空券プログラムの設定が無効です。"
  },
  "Invalid network": {
    "en": "Invalid route-network data.",
    "ja": "路線網のデータが無効です。"
  },
  "Duplicate airport": {
    "en": "Duplicate airport code.",
    "ja": "空港コードが重複しています。"
  },
  "Invalid custom route": {
    "en": "Invalid custom route.",
    "ja": "追加した路線のデータが無効です。"
  },
  "Missing overnight ledger": {
    "en": "The overnight-connection ledger is missing.",
    "ja": "日をまたぐ乗継の台帳がありません。"
  },
  "Invalid overnight connections": {
    "en": "Invalid overnight-connection data.",
    "ja": "日をまたぐ乗継のデータが無効です。"
  },
  "OD demand does not reconcile": {
    "en": "Origin–destination demand totals do not reconcile.",
    "ja": "出発地・目的地間の需要合計が一致しません。"
  },
  "Missing operated connecting leg": {
    "en": "An operated connecting leg is missing from the report.",
    "ja": "運航した乗継区間がレポートにありません。"
  },
  "Connecting ledger does not reconcile": {
    "en": "The connecting-ticket ledger does not reconcile.",
    "ja": "乗継航空券の台帳に不整合があります。"
  },
  "Invalid airline positioning": {
    "en": "Invalid airline positioning data.",
    "ja": "航空会社の事業方針データが無効です。"
  },
  "Invalid research prerequisites": {
    "en": "Invalid research prerequisites.",
    "ja": "研究の前提条件が無効です。"
  },
  "Invalid research project": {
    "en": "Invalid research project.",
    "ja": "研究プロジェクトのデータが無効です。"
  },
  "Rival leg ledger cursor mismatch": {
    "en": "The rival flight ledger's settlement time is inconsistent.",
    "ja": "競合の運航台帳の締め時刻に不整合があります。"
  },
  "Rival ticket ledger does not reconcile": {
    "en": "The rival's ticket ledger does not reconcile.",
    "ja": "競合の航空券台帳に不整合があります。"
  },
  "Rival cash reserve exceeded": {
    "en": "The rival's spending exceeds its available funds.",
    "ja": "競合の支出が保有資金を超えています。"
  },
  "Rival cash bridge does not reconcile": {
    "en": "The rival's cash balance does not match recorded transactions.",
    "ja": "競合の資金残高が取引記録と一致しません。"
  },
  "Invalid rival network expansion": {
    "en": "Invalid rival network-expansion data.",
    "ja": "競合の路線網拡大データが無効です。"
  },
  "Invalid migration backup ID": {
    "en": "Invalid migration-backup ID.",
    "ja": "移行前バックアップのIDが無効です。"
  },
  "Invalid slot migration backup ID": {
    "en": "Invalid slot-market migration-backup ID.",
    "ja": "発着枠市場への移行前バックアップのIDが無効です。"
  },
  "Invalid customer migration backup ID": {
    "en": "Invalid customer-strategy migration-backup ID.",
    "ja": "顧客戦略への移行前バックアップのIDが無効です。"
  },
  "Invalid rival network migration ID": {
    "en": "Invalid rival-network migration ID.",
    "ja": "競合の路線網拡大への移行IDが無効です。"
  },
  "Invalid slot reservation migration ID": {
    "en": "Invalid slot-reservation migration ID.",
    "ja": "発着枠の予約条件への移行IDが無効です。"
  },
  "Invalid slot utilization migration ID": {
    "en": "Invalid slot-utilization migration ID.",
    "ja": "発着枠の利用条件への移行IDが無効です。"
  },
  "Invalid slot migration ID": {
    "en": "Invalid slot-market migration ID.",
    "ja": "発着枠市場への移行IDが無効です。"
  },
  "Invalid shared slot market": {
    "en": "Invalid shared slot-market data.",
    "ja": "共有発着枠市場のデータが無効です。"
  },
  "Invalid slot spending": {
    "en": "Invalid slot-spending data.",
    "ja": "発着枠の支出データが無効です。"
  },
  "Invalid slot owner": {
    "en": "Invalid slot-holder data.",
    "ja": "発着枠の保有者データが無効です。"
  },
  "Invalid shared slot right": {
    "en": "Invalid shared-market slot right.",
    "ja": "共有市場の発着枠の権利が無効です。"
  },
  "Overallocated shared slot capacity": {
    "en": "Shared slots are allocated beyond capacity.",
    "ja": "共有発着枠の割り当てが上限を超えています。"
  },
  "Invalid shared slot report": {
    "en": "Invalid shared slot-market report.",
    "ja": "共有発着枠市場のレポートが無効です。"
  },
  "Invalid shared slot movement": {
    "en": "Invalid shared-market takeoff or landing record.",
    "ja": "共有発着枠市場の発着記録が無効です。"
  },
  "Invalid rival slot receipt": {
    "en": "Invalid rival slot-transaction record.",
    "ja": "競合の発着枠取引記録が無効です。"
  },
  "Conditional slot policy requires market version 2": {
    "en": "Conditional slot rules require market version 2.",
    "ja": "条件付き発着枠の規則には、市場バージョン2が必要です。"
  },
  "Invalid conditional slot terms": {
    "en": "Invalid conditional slot terms.",
    "ja": "条件付き発着枠の契約条件が無効です。"
  },
  "Utilization terms require market version 3": {
    "en": "Slot-utilization terms require market version 3.",
    "ja": "発着枠の利用条件には、市場バージョン3が必要です。"
  },
  "Invalid slot utilization terms": {
    "en": "Invalid slot-utilization terms.",
    "ja": "発着枠の利用条件が無効です。"
  },
  "Invalid rival growth": {
    "en": "Invalid rival-growth setting.",
    "ja": "競合の成長設定が無効です。"
  },
  "Invalid rival leases": {
    "en": "Invalid rival lease data.",
    "ja": "競合のリースデータが無効です。"
  },
  "Invalid strategy save": {
    "en": "Invalid saved competition-strategy data.",
    "ja": "保存された競争戦略のデータが無効です。"
  },
  "Invalid rival save": {
    "en": "Invalid saved rival data.",
    "ja": "保存された競合のデータが無効です。"
  },
  "Invalid strategy result": {
    "en": "Invalid strategy-challenge result.",
    "ja": "戦略チャレンジの結果が無効です。"
  },
  "Missing strategy result": {
    "en": "The strategy-challenge result is missing.",
    "ja": "戦略チャレンジの結果がありません。"
  },
  "Invalid competition history": {
    "en": "Invalid competition history.",
    "ja": "競争履歴のデータが無効です。"
  },
  "Invalid competition market": {
    "en": "Invalid competitive-market data.",
    "ja": "競争市場のデータが無効です。"
  }
};
