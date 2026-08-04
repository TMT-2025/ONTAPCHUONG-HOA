# Chemistry Chapter Review Generator (Bộ tạo tài liệu ôn tập Hóa học)

Ứng dụng web AI hỗ trợ tạo tài liệu ôn tập chi tiết theo từng chương của chương trình Hóa học lớp 10, 11, 12 bám sát SGK bộ **Kết nối tri thức với cuộc sống** (Chương trình GDPT 2018). Kết quả được xuất ra file Microsoft Word (.docx) được thiết kế và định dạng chuyên nghiệp.

## Tính năng nổi bật
- **Bám sát SGK Kết nối tri thức**: Hỗ trợ đầy đủ các chương và bài học của Hóa học 10, 11, 12.
- **Quy trình sinh thông minh**: Chia nhỏ quá trình sinh tài liệu thành 6 bước để tránh vượt quá giới hạn token của AI và cho phép tạo tài liệu cực kỳ chi tiết (từ 10 đến 30 trang A4).
- **Định dạng Word chuẩn giáo dục**:
  - Font chữ: **Times New Roman**, cỡ chữ **13pt**, giãn dòng **1.5**, căn lề đều (**Justified**).
  - Có trang bìa nghệ thuật, mục lục tự động.
  - Sử dụng **Office Math (OMML)** cho các phương trình hóa học phức tạp và Unicode cho các công thức hóa học inline.
  - Định dạng các hộp ghi chú (Lưu ý) màu vàng và mẹo ghi nhớ màu xanh nổi bật.

---

## Hướng dẫn Chạy local (Development)

### 1. Cài đặt Dependencies
Mở terminal tại thư mục dự án và chạy lệnh sau:
```bash
npm install
```

### 2. Thiết lập Environment (Optional)
Tạo file `.env` tại thư mục gốc và nhập API Key của Google AI Studio (nếu muốn chạy mặc định từ server):
```env
GEMINI_API_KEY=your_studio_api_key_here
```
*Lưu ý: Bạn cũng có thể nhập API Key trực tiếp trên giao diện web.*

### 3. Khởi động Ứng dụng
Chạy lệnh sau để khởi chạy song song cả React frontend và Express backend:
```bash
npm run dev
```
Giao diện sẽ chạy tại `http://localhost:5173`. Mọi request `/api` sẽ được tự động proxy tới server port `5000`.

---

## Hướng dẫn Deploy lên Vercel

Ứng dụng này đã được cấu hình sẵn cho việc deploy lên Vercel cực kỳ đơn giản với Serverless Functions (Express backend trong thư mục `api/`).

### Bước 1: Push mã nguồn lên GitHub
1. Khởi tạo Git và commit mã nguồn:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
2. Tạo một repository mới trên GitHub và push code lên.

### Bước 2: Deploy trên Vercel
1. Đăng nhập vào [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project** và import repository GitHub vừa tạo.
3. Trong phần cấu hình dự án:
   - **Framework Preset**: Chọn **Vite** (Vercel sẽ tự nhận diện).
   - **Environment Variables** (Tùy chọn): Thêm biến `GEMINI_API_KEY` với giá trị là API Key trả phí từ Google AI Studio của bạn.
4. Click **Deploy**. Vercel sẽ tự động build frontend và cấu hình serverless function cho thư mục `api/`.
5. Sau khi deploy hoàn tất, bạn sẽ nhận được một địa chỉ web để sử dụng trực tiếp!
