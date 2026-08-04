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
app.use(express.json({ limit: '10mb' }));

// Shared Strict Generation Instructions to enforce compliance
const sharedInstructions = `
TUYỆT ĐỐI TUÂN THỦ CÁC QUY TẮC SAU:
1. KHÔNG ĐƯỢC sử dụng cú pháp ký hiệu toán học LaTeX trong văn bản Markdown (Tuyệt đối CẤM viết dạng $...$, $$, \\Delta, \\sum, \\frac, \\cdot, \\rightarrow, \\text, \\quad...). 
   Thay vào đó, hãy dùng các ký tự văn bản thông thường và ký tự Hy Lạp Unicode trực tiếp:
   - Dùng chữ Hy Lạp trực tiếp: Δ (Delta) thay cho \\Delta, Σ (Sigma) thay cho \\sum hoặc \\Sigma.
   - Dùng dấu chấm giữa: · (U+00B7) hoặc dấu x cho phép nhân thay cho \\cdot.
   - Viết các biểu thức toán học dạng dòng thường (Ví dụ: n = m / M (mol), n = V / 24,79 (đktc), C_M = n / V).
   - Biểu diễn các phản ứng hóa học trực tiếp bằng các thẻ HTML <sub>/<sup> và mũi tên Unicode (→ hoặc ⇌). Ví dụ: 2H<sub>2</sub> + O<sub>2</sub> → 2H<sub>2</sub>O.
2. TUYỆT ĐỐI CẤM viết lời chào mừng, lời dẫn dắt xã giao, chào hỏi học sinh hay giới thiệu bản thân (Ví dụ: Nghiêm cấm viết "Chào các em học sinh thân mến!", "Với tư cách là giáo viên hơn 20 năm kinh nghiệm...", "Chào mừng các em đến với chương...", "Chúc các em học tập tốt..."). Hãy bắt đầu tài liệu trực tiếp bằng tiêu đề và nội dung kiến thức chuyên môn.
3. Tên chất và hóa chất PHẢI viết bằng tiếng Anh theo danh pháp IUPAC chuẩn (Ví dụ: Water, Hydrogen, Oxygen, Sodium chloride, Sulfuric acid, Nitric acid, Carbon dioxide, Iron(III) oxide...). Tuyệt đối không sử dụng tên tiếng Việt cũ.
4. Mọi công thức hóa học PHẢI sử dụng thẻ HTML <sub> và <sup> để biểu diễn chỉ số dưới và điện tích (Ví dụ: H<sub>2</sub>O, CO<sub>2</sub>, SO<sub>4</sub><sup>2-</sup>, Fe<sup>3+</sup>). Không viết chữ thường hoặc số thường như H2O hay Fe3+.
`;

// 1. GET /api/curriculum - Returns the full syllabus
app.get('/api/curriculum', (req, res) => {
  res.json(curriculum);
});

// 2. POST /api/generate-section - Calls Gemini to generate a single section
app.post('/api/generate-section', async (req, res) => {
  const { grade, chapterId, sectionType, lessonName, customApiKey, customModel } = req.body;

  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing API Key. Vui lòng cấu hình API Key từ màn hình cài đặt." });
  }

  const modelName = customModel || "gemini-3.1-flash-lite";

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
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Giới thiệu chương** và **Mục tiêu, Kiến thức cần đạt** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung cần viết chi tiết, khoa học, giúp học sinh tự học định hướng rõ mục tiêu.
        
        Yêu cầu đặc biệt cho phần này:
        - Phần "Mục tiêu, Kiến thức cần đạt" phải được chia làm đúng 2 nội dung lớn là:
          1. **Mục tiêu**: trình bày rõ các mục tiêu cần hướng tới về mặt phát triển năng lực học sinh (bao gồm Năng lực hóa học và Năng lực chung).
          2. **Kiến thức cần đạt**: liệt kê chi tiết các đơn vị kiến thức, yêu cầu cần đạt trọng tâm của chương mà học sinh cần phải nắm vững sau khi học xong.
        - TUYỆT ĐỐI KHÔNG ĐƯỢC tạo thêm các mục tiêu liên quan đến "Thái độ và giá trị", "Phẩm chất", "Thái độ" hay bất kỳ nội dung nào khác ngoài 2 phần trên.
        
        ${sharedInstructions}`;
        break;

      case 'lesson':
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Kiến thức trọng tâm chi tiết** cho bài học:
        - Bài học: ${lessonName}
        - Thuộc chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung của bài học phải cực kỳ đầy đủ, chi tiết để học sinh tự học. Vui lòng viết tất cả các nội dung sau (nếu bài học có):
        1. Khái niệm (Định nghĩa rõ ràng, chính xác)
        2. Bản chất (Giải thích ở cấp độ nguyên tử, phân tử, cấu tạo electron hoặc liên kết)
        3. Giải thích hiện tượng hoặc cơ chế
        4. Điều kiện xảy ra phản ứng hoặc các quy luật liên quan
        5. Đặc điểm cấu tạo hoặc liên kết hóa học
        6. Tính chất hóa học và vật lý (kèm đầy đủ các phương trình phản ứng hóa học minh họa chính xác)
        7. Ví dụ minh họa thực tế chi tiết
        8. Lưu ý quan trọng (Định dạng như một đoạn văn bắt đầu bằng '**Lưu ý:**')
        9. Điều cần nhớ (Tóm tắt lại các ý quan trọng nhất cần học thuộc lòng)
        
        ${sharedInstructions}`;
        break;

      case 'summary_mindmap':
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Tổng hợp công thức, Quy tắc và Bảng tổng hợp kiến thức** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung biên soạn phải bao gồm:
        1. Các công thức hóa học/toán học quan trọng cần nhớ trong chương (Ví dụ: tính số mol, nồng độ, biến thiên enthalpy, tốc độ phản ứng...), nếu có.
        2. Các quy tắc quan trọng của chương (Ví dụ: quy tắc octet, quy tắc gọi tên, quy tắc an toàn...), nếu có.
        3. Bảng tổng hợp so sánh hoặc hệ thống hóa kiến thức trọng tâm của chương (Bắt buộc sử dụng định dạng bảng Markdown).
        
        Lưu ý đặc biệt cho phần này:
        - TUYỆT ĐỐI KHÔNG ĐƯỢC tạo mục "Sơ đồ tư duy" (dạng văn bản hay bất kỳ dạng nào khác). Bỏ hoàn toàn mục này.
        
        ${sharedInstructions}`;
        break;

      case 'exercises':
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy viết tài liệu ôn tập phần **Các dạng bài tập ôn tập tiêu biểu** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung cần bao gồm các dạng bài tập điển hình nhất của chương. Với mỗi dạng bài tập, hãy cung cấp đầy đủ:
        - Tên dạng bài tập
        - Dấu hiệu nhận biết dạng bài
        - Phương pháp giải chi tiết (các bước cụ thể)
        - Ít nhất 2 ví dụ mẫu minh họa có lời giải chi tiết (kèm phương trình phản ứng hóa học chính xác).
        
        ${sharedInstructions}`;
        break;

      case 'mistakes_tips':
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Các lỗi sai thường gặp, Mẹo ghi nhớ nhanh và Liên hệ thực tiễn** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung bao gồm:
        1. Các lỗi sai lý thuyết hoặc lỗi tính toán mà học sinh thường mắc phải trong chương này, kèm giải thích tại sao sai và cách khắc phục.
        2. Mẹo ghi nhớ nhanh kiến thức, mẹo tính nhanh hoặc thơ vui nhớ kiến thức (Định dạng như một đoạn văn bắt đầu bằng '**Mẹo ghi nhớ:**').
        3. Liên hệ thực tiễn và ứng dụng đời sống: các hiện tượng thực tế giải thích bằng kiến thức của chương này (Ví dụ: sự ăn mòn kim loại trong đời sống, ứng dụng các chất...).
        
        ${sharedInstructions}`;
        break;

      case 'tests_checklist':
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Câu hỏi tự kiểm tra tự luận/trắc nghiệm, Checklist tự đánh giá và Tóm tắt chương** cho chương sau:
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
        
        ${sharedInstructions}`;
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
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Tai-lieu-on-tap-Chuong-${chapterId}-Hoa-${grade}.docx`);
    res.send(buffer);
  } catch (error) {
    console.error("DOCX Export Error:", error);
    res.status(500).json({ error: `Xuất file Word thất bại: ${error.message}` });
  }
});

module.exports = app;
