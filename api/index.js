const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const curriculum = require('./helpers/curriculum');
const { generateDocx } = require('./helpers/docxHelper');
const docx = require('docx');
const Packer = docx.Packer;

// Load dotenv for local development
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for large markdown contents

// 1. GET /api/curriculum - Returns the full syllabus
app.get('/api/curriculum', (req, res) => {
  res.json(curriculum);
});

// 2. POST /api/generate-section - Calls Gemini to generate a single section
app.post('/api/generate-section', async (req, res) => {
  const { grade, chapterId, sectionType, lessonName, customApiKey, customModel } = req.body;

  // Use API key: try custom header/body first, then environment variable
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing API Key. Vui lòng nhập API Key của bạn." });
  }

  // Model name selection: default to gemini-3.1-flash-lite as requested by user
  const modelName = customModel || "gemini-3.1-flash-lite";

  // Find chapter in curriculum
  const gradeData = curriculum[grade];
  if (!gradeData) {
    return res.status(400).json({ error: "Lớp không hợp lệ." });
  }
  const chapter = gradeData.chapters.find(c => c.id === parseInt(chapterId));
  if (!chapter) {
    return res.status(400).json({ error: "Chương không hợp lệ." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    let prompt = "";

    switch (sectionType) {
      case 'intro':
        prompt = `Bạn là giáo viên Hóa học THPT với hơn 20 năm kinh nghiệm giảng dạy. Hãy biên soạn phần **Giới thiệu chương** và **Mục tiêu, Kiến thức cần đạt** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung cần viết chi tiết, khoa học, giúp học sinh có cái nhìn khái quát và xác định rõ mục tiêu cần tự học.
        
        Yêu cầu bắt buộc:
        1. Tên các hóa chất và hợp chất PHẢI viết bằng tiếng Anh theo danh pháp IUPAC chuẩn (Ví dụ: Water, Hydrogen, Oxygen, Sodium chloride, Sulfuric acid, Nitric acid, Potassium permanganate, Copper(II) sulfate, Iron(III) oxide, Calcium carbonate...). Không sử dụng tên tiếng Việt cũ.
        2. Mọi công thức hóa học PHẢI sử dụng thẻ HTML <sub> và <sup> để biểu diễn chỉ số dưới và điện tích (Ví dụ: H<sub>2</sub>O, CO<sub>2</sub>, SO<sub>4</sub><sup>2-</sup>, NH<sub>4</sub><sup>+</sup>, Fe<sup>3+</sup>). Không viết chữ/số thường như H2O hay Fe3+.
        3. Các phương trình phản ứng hóa học phải viết chính xác hệ số, chỉ số dưới, điện tích và mũi tên phản ứng đúng (→ cho phản ứng một chiều, ⇌ cho phản ứng thuận nghịch). Ví dụ: 2H<sub>2</sub> + O<sub>2</sub> → 2H<sub>2</sub>O.
        
        Trả về kết quả ở định dạng Markdown chuẩn.`;
        break;

      case 'lesson':
        prompt = `Bạn là giáo viên Hóa học THPT với hơn 20 năm kinh nghiệm giảng dạy. Hãy biên soạn phần **Kiến thức trọng tâm chi tiết** cho bài học:
        - Bài học: ${lessonName}
        - Thuộc chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung của bài học phải cực kỳ đầy đủ, chi tiết và sâu sắc để học sinh tự học hiệu quả. Vui lòng viết đầy đủ tất cả các nội dung sau (nếu bài học có):
        1. Khái niệm (Định nghĩa rõ ràng, chính xác)
        2. Bản chất (Giải thích ở cấp độ nguyên tử, phân tử, cấu tạo electron hoặc liên kết)
        3. Giải thích hiện tượng hoặc cơ chế
        4. Điều kiện xảy ra phản ứng hoặc các quy luật liên quan
        5. Đặc điểm cấu tạo hoặc liên kết hóa học
        6. Tính chất hóa học và vật lý (kèm đầy đủ các phương trình phản ứng hóa học minh họa chính xác)
        7. Ví dụ minh họa thực tế chi tiết
        8. Lưu ý quan trọng (Định dạng như một đoạn văn bắt đầu bằng '**Lưu ý:**')
        9. Điều cần nhớ (Tóm tắt lại các ý quan trọng nhất cần học thuộc lòng)
        
        Yêu cầu bắt buộc:
        1. Tên hóa chất viết bằng tiếng Anh theo danh pháp IUPAC (Ví dụ: Water, Hydrogen, Oxygen, Sodium chloride, Sulfuric acid, Nitric acid...). Không dùng tiếng Việt.
        2. Công thức hóa học PHẢI dùng thẻ <sub> và <sup> (Ví dụ: H<sub>2</sub>O, SO<sub>4</sub><sup>2-</sup>, NH<sub>4</sub><sup>+</sup>, Fe<sup>3+</sup>).
        3. Phương trình phản ứng hóa học phải viết chính xác (mũi tên phản ứng đúng: → cho một chiều, ⇌ cho thuận nghịch). Ví dụ: Zn + 2HCl → ZnCl<sub>2</sub> + H<sub>2</sub>.
        
        Trả về kết quả ở định dạng Markdown chuẩn.`;
        break;

      case 'summary_mindmap':
        prompt = `Bạn là giáo viên Hóa học THPT với hơn 20 năm kinh nghiệm giảng dạy. Hãy biên soạn phần **Tổng hợp công thức, Quy tắc, Bảng tổng hợp kiến thức và Sơ đồ tư duy dạng văn bản** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung biên soạn phải bao gồm:
        1. Các công thức hóa học/toán học quan trọng cần nhớ trong chương (Ví dụ: tính số mol, nồng độ, biến thiên enthalpy, tốc độ phản ứng...), nếu có.
        2. Các quy tắc quan trọng của chương (Ví dụ: quy tắc octet, quy tắc gọi tên, quy tắc an toàn...), nếu có.
        3. Bảng tổng hợp so sánh hoặc hệ thống hóa kiến thức trọng tâm của chương (Bắt buộc sử dụng định dạng bảng Markdown).
        4. Sơ đồ tư duy dạng văn bản (Sử dụng danh sách thụt đầu dòng nhiều cấp để mô hình hóa toàn bộ kiến thức của chương).
        
        Yêu cầu bắt buộc:
        1. Tên hóa chất viết bằng tiếng Anh IUPAC.
        2. Công thức hóa học PHẢI dùng thẻ <sub> và <sup> (Ví dụ: H<sub>2</sub>O, CO<sub>2</sub>, SO<sub>4</sub><sup>2-</sup>).
        3. Trả về kết quả ở định dạng Markdown chuẩn.`;
        break;

      case 'exercises':
        prompt = `Bạn là giáo viên Hóa học THPT với hơn 20 năm kinh nghiệm giảng dạy. Hãy biên soạn phần **Các dạng bài tập ôn tập tiêu biểu** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung cần bao gồm các dạng bài tập điển hình nhất của chương. Với mỗi dạng bài tập, hãy cung cấp đầy đủ:
        - Tên dạng bài tập
        - Dấu hiệu nhận biết dạng bài
        - Phương pháp giải chi tiết (các bước cụ thể)
        - Ít nhất 2 ví dụ mẫu minh họa có lời giải chi tiết (kèm phương trình phản ứng hóa học chính xác).
        
        Yêu cầu bắt buộc:
        1. Tên hóa chất viết bằng tiếng Anh IUPAC.
        2. Công thức hóa học PHẢI dùng thẻ <sub> và <sup> (Ví dụ: H<sub>2</sub>O, ZnCl<sub>2</sub>).
        3. Trả về kết quả ở định dạng Markdown chuẩn.`;
        break;

      case 'mistakes_tips':
        prompt = `Bạn là giáo viên Hóa học THPT với hơn 20 năm kinh nghiệm giảng dạy. Hãy biên soạn phần **Các lỗi sai thường gặp, Mẹo ghi nhớ nhanh và Liên hệ thực tiễn** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung bao gồm:
        1. Các lỗi sai lý thuyết hoặc lỗi tính toán mà học sinh thường mắc phải trong chương này, kèm giải thích tại sao sai và cách khắc phục.
        2. Mẹo ghi nhớ nhanh kiến thức, mẹo tính nhanh hoặc thơ vui nhớ kiến thức (Định dạng như một đoạn văn bắt đầu bằng '**Mẹo ghi nhớ:**').
        3. Liên hệ thực tiễn và ứng dụng đời sống: các hiện tượng thực tế giải thích bằng kiến thức của chương này (Ví dụ: sự ăn mòn kim loại trong đời sống, ứng dụng các chất...).
        
        Yêu cầu bắt buộc:
        1. Tên hóa chất viết bằng tiếng Anh IUPAC.
        2. Công thức hóa học PHẢI dùng thẻ <sub> và <sup>.
        3. Trả về kết quả ở định dạng Markdown chuẩn.`;
        break;

      case 'tests_checklist':
        prompt = `Bạn là giáo viên Hóa học THPT với hơn 20 năm kinh nghiệm giảng dạy. Hãy biên soạn phần **Câu hỏi tự kiểm tra tự luận/trắc nghiệm, Checklist tự đánh giá và Tóm tắt chương** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung bao gồm:
        1. Hệ thống câu hỏi tự kiểm tra đánh giá năng lực học sinh (Không cần cung cấp đáp án):
           - Nhận biết (Ít nhất 5 câu hỏi trắc nghiệm hoặc lý thuyết hỏi đáp ngắn)
           - Thông hiểu (Ít nhất 3 câu tự luận giải thích hiện tượng hóa học)
           - Vận dụng/Vận dụng cao (Ít nhất 2 bài tập tính toán định lượng hoặc tình huống thực tế giải quyết vấn đề)
        2. Checklist tự đánh giá kiến thức: Bảng tự đánh giá với danh sách các kiến thức cốt lõi (Bắt buộc dùng định dạng bảng Markdown có các cột: 'Nội dung kiến thức', 'Đã vững', 'Cần ôn lại', 'Ghi chú').
        3. Tóm tắt chương (1-2 đoạn văn ngắn gọn khái quát tinh thần của cả chương).
        
        Yêu cầu bắt buộc:
        1. Tên hóa chất viết bằng tiếng Anh IUPAC.
        2. Công thức hóa học PHẢI dùng thẻ <sub> và <sup>.
        3. Trả về kết quả ở định dạng Markdown chuẩn.`;
        break;

      default:
        return res.status(400).json({ error: "Loại phần sinh nội dung không hợp lệ." });
    }

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json({ markdown: text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: `AI Generation failed: ${error.message}` });
  }
});

// 3. POST /api/export-docx - Converts accumulated markdown into a Word doc and returns buffer
app.post('/api/export-docx', async (req, res) => {
  const { grade, chapterId, markdownContent } = req.body;

  if (!markdownContent) {
    return res.status(400).json({ error: "Thiếu nội dung tài liệu để xuất." });
  }

  // Find chapter in curriculum to get official name
  const gradeData = curriculum[grade];
  let chapterTitle = "Tài liệu ôn tập";
  if (gradeData) {
    const chapter = gradeData.chapters.find(c => c.id === parseInt(chapterId));
    if (chapter) {
      chapterTitle = `Chương ${chapter.id}. ${chapter.title}`;
    }
  }

  try {
    const doc = generateDocx(grade, chapterTitle, markdownContent);
    const buffer = await Packer.toBuffer(doc);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Tai-lieu-on-tap-Chuong-${chapterId}-Hoa-${grade}.docx`);
    res.send(buffer);
  } catch (error) {
    console.error("DOCX Export Error:", error);
    res.status(500).json({ error: `Xuất file Word thất bại: ${error.message}` });
  }
});

module.exports = app;
