// Append-only IDs preserve legacy purchased equipment. All values are game balance.
export const AMENITY_GROUPS=['Kết nối','Giải trí','Không gian & ghế','Dịch vụ'];
export const OPTIONS={
 wifi:{name:'Wi-Fi vệ tinh',group:0,icon:'wifi',price:85000,revenue:2,cost:.6,comfort:.15,detail:'Kết nối Internet trong chuyến bay; phù hợp khách công tác.'},
 screen:{name:'Màn hình giải trí lớn',group:1,icon:'screen',price:120000,revenue:1.5,cost:.4,comfort:.15,detail:'Màn hình riêng tại ghế với thư viện phim và chương trình giải trí.'},
 seats:{name:'Ghế tiện nghi',group:2,icon:'seat',price:180000,revenue:2.5,cost:1,comfort:.3,detail:'Đệm ghế và tựa đầu nâng cấp; giữ nguyên số ghế đã cấu hình.'},
 usb:{name:'Cổng sạc USB-C',group:0,icon:'power',price:40000,revenue:.8,cost:.15,comfort:.05,detail:'Cổng sạc cá nhân cho điện thoại và máy tính bảng.'},
 power:{name:'Ổ điện tại ghế',group:0,icon:'power',price:65000,revenue:.9,cost:.25,comfort:.04,detail:'Cấp điện cho máy tính xách tay, bổ sung cho cổng USB-C.'},
 streaming:{name:'Kho phim trên thiết bị cá nhân',group:1,icon:'screen',price:70000,revenue:1.1,cost:.35,comfort:.04,detail:'Kho nội dung nội bộ cho điện thoại; hoạt động độc lập với gói Internet.'},
 audio:{name:'Tai nghe chống ồn',group:1,icon:'audio',price:55000,revenue:.8,cost:.4,comfort:.06,detail:'Bộ tai nghe mượn trên chuyến bay; có chi phí vệ sinh mỗi lượt khách.'},
 legrest:{name:'Tựa chân điều chỉnh',group:2,icon:'seat',price:125000,revenue:1.1,cost:.45,comfort:.08,detail:'Bổ sung tựa chân gập cho bộ ghế; không biến ghế thành giường nằm.'},
 lighting:{name:'Ánh sáng cabin theo nhịp bay',group:2,icon:'light',price:95000,revenue:.55,cost:.2,comfort:.08,detail:'Đèn chuyển cảnh lúc đón khách, dùng bữa và nghỉ ngơi.'},
 quiet:{name:'Cách âm cabin nâng cấp',group:2,icon:'quiet',price:210000,revenue:.9,cost:.3,comfort:.1,detail:'Tăng sự yên tĩnh trong mô phỏng; vốn đầu tư cao, thu hồi chậm hơn.'},
 air:{name:'Không khí cabin nâng cấp',group:2,icon:'air',price:110000,revenue:.5,cost:.25,comfort:.06,detail:'Gói tiện nghi thông gió bổ sung; không thay thế hệ thống an toàn tiêu chuẩn.'},
 bins:{name:'Khoang hành lý rộng',group:2,icon:'bag',price:140000,revenue:.7,cost:.2,comfort:.05,detail:'Tăng tiện lợi cho hành lý xách tay; không đổi thời gian quay đầu trong PoC.'},
 meals:{name:'Thực đơn tuyển chọn',group:3,icon:'meal',price:90000,revenue:4,cost:2.8,comfort:.08,detail:'Nâng cấp suất ăn phục vụ tại ghế; doanh thu cao đi cùng chi phí nguyên liệu.'},
 coffee:{name:'Cà phê & đồ uống đặc biệt',group:3,icon:'coffee',price:45000,revenue:1.7,cost:.85,comfort:.04,detail:'Bổ sung danh mục đồ uống vào dịch vụ trên chuyến bay.'},
 bedding:{name:'Chăn gối cao cấp',group:3,icon:'bed',price:60000,revenue:1.1,cost:.65,comfort:.07,detail:'Bộ chăn gối mềm cho mọi hạng ghế; chi phí giặt tính theo khách.'},
 kit:{name:'Bộ tiện ích cá nhân',group:3,icon:'bag',price:35000,revenue:1.25,cost:.8,comfort:.04,detail:'Bịt mắt, nút tai và vật dụng nhỏ dành cho hành khách.'}
};
export const optionEffects=p=>(p.options||[]).reduce((n,k)=>({revenue:n.revenue+OPTIONS[k].revenue,cost:n.cost+OPTIONS[k].cost}),{revenue:0,cost:0});
export const cabinQuality=p=>Math.min(1,.25+(p.options||[]).reduce((n,k)=>n+OPTIONS[k].comfort,0));
