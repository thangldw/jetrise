// Append-only IDs preserve saved aircraft paint selections.
export const LIVERIES=[
 {name:'VANTIS Coral',price:30000,group:'Nhận diện',pattern:'brand',color:null,accent:'#d9bd91',detail:'Logo hãng, đuôi màu chủ đạo và đường viền thân tối giản.'},
 {name:'Tết · Thịnh vượng',price:60000,group:'Lễ hội',pattern:'festival',color:'#A81E32',accent:'#D9BD91',detail:'Đỏ son và dải vàng chéo gợi không khí đầu năm.'},
 {name:'Kỷ niệm · Aurora',price:75000,group:'Đặc biệt',pattern:'aurora',color:'#283A85',accent:'#739CF1',detail:'Dải cực quang xanh uốn dọc thân và đuôi.'},
 {name:'Midnight Gold',price:85000,group:'Cao cấp',pattern:'horizon',color:'#18273E',accent:'#DBB96B',detail:'Xanh đêm với đường chỉ vàng và đường chân trời.'},
 {name:'Ocean Flow',price:65000,group:'Thiên nhiên',pattern:'waves',color:'#08758B',accent:'#72DFDF',detail:'Ba lớp sóng biển chuyển động dọc thân.'},
 {name:'Sunrise',price:65000,group:'Thiên nhiên',pattern:'sunrise',color:'#B94C24',accent:'#FFD17A',detail:'Mặt trời mọc và các dải cam vàng ấm.'},
 {name:'Jade Bamboo',price:70000,group:'Thiên nhiên',pattern:'bamboo',color:'#17614B',accent:'#ACD8AC',detail:'Những đốt tre và tán lá ngọc lục bảo.'},
 {name:'Heritage Retro',price:55000,group:'Nhận diện',pattern:'retro',color:'#8C3434',accent:'#E8CDA1',detail:'Ba đường kẻ cổ điển chạy ngang thân.'},
 {name:'Carbon Sport',price:90000,group:'Cao cấp',pattern:'carbon',color:'#222C3B',accent:'#EF9C45',detail:'Thân tối, lưới carbon và điểm nhấn cam thể thao.'},
 {name:'Sakura Season',price:80000,group:'Lễ hội',pattern:'sakura',color:'#A42E66',accent:'#F9C9E2',detail:'Cánh hoa anh đào rải trên thân và đuôi.'},
 {name:'Winter Snow',price:80000,group:'Lễ hội',pattern:'snow',color:'#215B8D',accent:'#D1EDFF',detail:'Bông tuyết sáng và dải băng xanh lạnh.'},
 {name:'Tropical Summer',price:70000,group:'Thiên nhiên',pattern:'sunrise',color:'#117C73',accent:'#F2C454',detail:'Mặt trời vàng trên nền xanh nhiệt đới.'},
 {name:'Silver Jubilee',price:95000,group:'Đặc biệt',pattern:'silver',color:'#4D627B',accent:'#CAD9E5',detail:'Mảng bạc cắt chéo và những vệt kỷ niệm thanh lịch.'},
 {name:'Star Voyager',price:100000,group:'Đặc biệt',pattern:'stars',color:'#302658',accent:'#D3BAF7',detail:'Chòm sao và các đường quỹ đạo trên nền tím đêm.'},
 {name:'Prism Geometry',price:75000,group:'Đặc biệt',pattern:'prism',color:'#314B9A',accent:'#50D0BC',detail:'Các mảng tam giác xanh, bạc và ngọc lam.'},
 {name:'Lotus Signature',price:85000,group:'Cao cấp',pattern:'lotus',color:'#86405A',accent:'#F0C995',detail:'Cánh sen cách điệu phối hồng trầm và vàng nhạt.'},
 {name:'Skyline Horizon',price:70000,group:'Nhận diện',pattern:'horizon',color:'#27618A',accent:'#9DCBE8',detail:'Đường chân trời và các vệt xanh hướng về phía trước.'},
 {name:'Festival Lights',price:90000,group:'Lễ hội',pattern:'confetti',color:'#61358B',accent:'#F8BE53',detail:'Những mảnh giấy hội nhiều màu và dải đuôi nổi bật.'}
];
export const LIVERY_GROUPS=[...new Set(LIVERIES.map(l=>l.group))];
export function liveryStyle(index,brand='#ff5955'){const l=LIVERIES[index]||LIVERIES[0];return {...l,color:l.color||brand};}
// Fuselage name ink: the brand color itself, or dark navy when the color is too light to read on the white band.
export function nameInk(color){const m=/^#([0-9a-f]{6})$/i.exec(color||'');if(!m)return '#17314a';const c=m[1].match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return 1.05/(.2126*c[0]+.7152*c[1]+.0722*c[2]+.05)>=3?color:'#17314a';}
