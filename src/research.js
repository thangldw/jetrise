// Append-only research IDs. The three legacy foundations keep their original prices and effects.
export const RESEARCH = {
  fuel: {branch: 'efficiency', name: 'Tối ưu nhiên liệu', price: 250000, days: 0, detail: 'Giảm 6% nhiên liệu mỗi vòng.'},
  comfort: {branch: 'commercial', name: 'Trải nghiệm hành khách', price: 200000, days: 0, detail: 'Giữ quyền lợi cũ: +10% nhu cầu khi chưa bật AI; +0,1 chất lượng khi cạnh tranh, giới hạn chất lượng 1.'},
  maintenance: {branch: 'reliability', name: 'Bảo dưỡng dự đoán', price: 220000, days: 0, detail: 'Hao mòn cơ sở giảm từ 0,9 xuống 0,6 mỗi vòng.'},
  dispatch: {branch: 'efficiency', requires: 'fuel', name: 'Điều hành tiết kiệm', price: 450000, days: 3, detail: 'Giảm thêm 3% nhiên liệu còn lại và CO₂ tương ứng. Không đổi thời gian bay.'},
  lightweight: {branch: 'efficiency', requires: 'dispatch', name: 'Tối ưu tải khai thác', price: 800000, days: 5, detail: 'Giảm tiếp 2% nhiên liệu còn lại. Giữ nguyên số ghế, hàng ghế và tầm bay.'},
  serviceSystems: {branch: 'commercial', requires: 'comfort', name: 'Quy trình phục vụ', price: 380000, days: 3, detail: 'Giảm 20% chi phí phục vụ/khách của định vị hãng; không giảm phí cố định hoặc gói mặt đất.'},
  loyalty: {branch: 'commercial', requires: 'serviceSystems', name: 'Chăm sóc khách mục tiêu', price: 650000, days: 5, detail: 'Tăng 6% hệ số lựa chọn của nhóm khách mục tiêu trong định vị đang dùng. Không tạo thêm ghế hay bảo đảm doanh thu.'},
  diagnostics: {branch: 'reliability', requires: 'maintenance', name: 'Chẩn đoán theo tình trạng', price: 420000, days: 3, detail: 'Giảm thêm 15% hao mòn còn lại mỗi vòng. Không sửa sự cố đã có.'},
  reliability: {branch: 'reliability', requires: 'diagnostics', name: 'Kiểm soát độ bền', price: 700000, days: 5, detail: 'Giảm tiếp 10% hao mòn còn lại. Giữ nguyên hạn kiểm tra tuần, thời gian và giá bảo dưỡng.'},
};
export const RESEARCH_BRANCHES = [
  {id: 'efficiency', name: 'Hiệu suất khai thác', keys: ['fuel', 'dispatch', 'lightweight']},
  {id: 'commercial', name: 'Dịch vụ & thị trường', keys: ['comfort', 'serviceSystems', 'loyalty']},
  {id: 'reliability', name: 'Độ bền đội bay', keys: ['maintenance', 'diagnostics', 'reliability']},
];

// Projections include a paid project's completion on its due day, without mutating progress.
export function effectiveResearch(s, day = s.day) {
  const completed = new Set(s.tycoon?.research || []), project = s.hq?.researchProject;
  if (project && day >= project.readyDay) completed.add(project.key);
  return completed;
}
export function researchEffects(s, day = s.day) {
  const done = effectiveResearch(s, day);
  return {fuel: (done.has('dispatch') ? .97 : 1) * (done.has('lightweight') ? .98 : 1),
    wear: (done.has('diagnostics') ? .85 : 1) * (done.has('reliability') ? .9 : 1),
    positioningCost: done.has('serviceSystems') ? .8 : 1, loyalty: done.has('loyalty') ? 1.06 : 1};
}
export function researchBlock(s, key) {
  const node = Object.hasOwn(RESEARCH, key) && RESEARCH[key];
  if (!node) return 'Nghiên cứu không hợp lệ.';
  if (s.tycoon.research.includes(key)) return 'Nghiên cứu đã hoàn tất; quyền lợi vẫn được giữ.';
  if (node.requires && !s.tycoon.research.includes(node.requires)) return 'Cần hoàn tất '+RESEARCH[node.requires].name+' trước.';
  if (s.hq.researchProject) return s.hq.researchProject.key === key ? 'Dự án đang chạy; có hiệu lực từ ngày '+s.hq.researchProject.readyDay+'.' : 'Hoàn tất hoặc huỷ dự án đang chạy trước khi bắt đầu nghiên cứu khác.';
  if (s.day + node.days > 9999) return 'Không còn đủ ngày trong giới hạn PoC.';
  if (s.cash < node.price) return 'Ngân quỹ chưa đủ cho nghiên cứu.';
  return null;
}
export function startResearch(s, key) {
  const block = researchBlock(s, key); if (block) throw Error(block);
  const node = RESEARCH[key]; s.cash -= node.price;
  if (!node.days) { s.tycoon.research.push(key); return 'Đã hoàn tất nghiên cứu '+node.name+'.'; }
  s.hq.researchProject = {key, startedDay: s.day, readyDay: s.day + node.days};
  return 'Đã bắt đầu '+node.name+'; có hiệu lực từ ngày '+s.hq.researchProject.readyDay+'.';
}
export function completeResearch(s) {
  const project = s.hq.researchProject;
  if (!project || s.day < project.readyDay) return null;
  if (!s.tycoon.research.includes(project.key)) s.tycoon.research.push(project.key);
  delete s.hq.researchProject;
  return project.key;
}
export function validateResearch(s) {
  const done = s.tycoon.research;
  if (done.some(key => !Object.hasOwn(RESEARCH, key) || RESEARCH[key].requires && !done.includes(RESEARCH[key].requires))) throw Error('Invalid research prerequisites');
  const p = s.hq.researchProject; if (p === undefined) return;
  const node = p && Object.hasOwn(RESEARCH, p.key) && RESEARCH[p.key];
  if (!node?.days || done.includes(p.key) || !done.includes(node.requires) || !Number.isInteger(p.startedDay) || p.startedDay < 1 || p.startedDay > s.day || p.readyDay !== p.startedDay + node.days || p.readyDay <= s.day || p.readyDay > 9999) throw Error('Invalid research project');
}
