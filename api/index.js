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
5. TẤT CẢ các tiêu đề, tên chương, tên bài học (dù viết chữ thường hay viết IN HOA toàn bộ) BẮT BUỘC phải viết bằng Tiếng Việt có đầy đủ dấu.
   Ví dụ viết đúng: "TỔNG HỢP KIẾN THỨC CHƯƠNG 5: NĂNG LƯỢNG HÓA HỌC - HÓA HỌC 10 (KẾT NỐI TRI THỨC)". 
   Tuyệt đối KHÔNG ĐƯỢC viết không dấu (Ví dụ viết sai: "TONG HOP KIEN THUC CHUONG 5: NANG LUONG HOA HOC - HOA HOC 10 (KET NOI TRI THUC)").
`;

// 1. GET /api/curriculum - Returns the full syllabus
app.get('/api/curriculum', (req, res) => {
  res.json(curriculum);
});

// 2. POST /api/generate-section - Calls Gemini to generate a single section
app.post('/api/generate-section', async (req, res) => {
  const { grade, chapterId, sectionType, lessonName, customApiKey, customModel, programType = 'standard' } = req.body;

  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: "Missing API Key. Vui lòng cấu hình API Key từ màn hình cài đặt." });
  }

  const modelName = customModel || "gemini-3.5-flash-lite";

  const targetProgram = curriculum[programType] ? programType : 'standard';
  const gradeData = curriculum[targetProgram]?.[grade];
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
    const programTypeName = programType === 'topics' 
      ? 'Chuyên đề học tập (Học sinh học theo sách Chuyên đề học tập Hóa học THPT)' 
      : 'Chương trình cốt lõi (Học sinh học theo sách giáo khoa Hóa học cốt lõi THPT)';
    const lessonListStr = chapter.lessons.join(', ');

    switch (sectionType) {
      case 'intro': {
        const uppercaseTitle = chapter.title.toUpperCase();
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Giới thiệu chương** và **Mục tiêu, Kiến thức cần đạt** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Loại chương trình: ${programTypeName}
        - Các bài học trong chương/chuyên đề này: ${lessonListStr}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung cần viết ngắn gọn, khoa học, súc tích giúp học sinh tự học định hướng nhanh mục tiêu.
        
        Yêu cầu đặc biệt về cấu trúc tiêu đề (BẮT BUỘC):
        - Bắt đầu tài liệu bằng tiêu đề chương viết hoa định dạng Heading 1:
          # CHƯƠNG ${chapter.id}: ${uppercaseTitle}
        - Tiếp theo là phần giới thiệu chương định dạng Heading 2:
          ## I. GIỚI THIỆU CHƯƠNG
          (Viết đoạn văn ngắn giới thiệu bối cảnh chương học)
        - Tiếp theo là phần mục tiêu định dạng Heading 2:
          ## II. MỤC TIÊU, KIẾN THỨC CẦN ĐẠT
          - Viết tiêu đề nhỏ định dạng Heading 3:
            ### Mục tiêu
            (Nêu ngắn gọn mục tiêu phát triển năng lực hóa học và năng lực chung trong khoảng 30 - 60 chữ)
          - Viết tiêu đề nhỏ định dạng Heading 3:
            ### Kiến thức cần đạt
            (Nêu ngắn gọn các yêu cầu kiến thức cốt lõi cần đạt trong khoảng 30 - 60 chữ)
        - TUYỆT ĐỐI KHÔNG ĐƯỢC tạo thêm các mục tiêu liên quan đến "Thái độ và giá trị", "Phẩm chất", "Thái độ" hay bất kỳ nội dung nào khác ngoài các phần trên.
        
        ${sharedInstructions}`;
        break;
      }

      case 'lesson': {
        const { isFirstLesson } = req.body;
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Kiến thức trọng tâm chi tiết** cho bài học:
        - Bài học: ${lessonName}
        - Thuộc chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Loại chương trình: ${programTypeName}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Nội dung của bài học phải cực kỳ đầy đủ, chi tiết để học sinh tự học.
        
        Yêu cầu đặc biệt về cấu trúc tiêu đề (BẮT BUỘC):
        ${isFirstLesson ? `- Do đây là bài học đầu tiên trong chương, bạn PHẢI bắt đầu bằng tiêu đề lớn định dạng Heading 1:
          # III. NỘI DUNG KIẾN THỨC` : ''}
        - Tên bài học phải định dạng Heading 2:
          ## ${lessonName}
        - Các mục nội dung bên dưới bài học phải định dạng Heading 3:
          ### Khái niệm
          (Trình bày khái niệm, định nghĩa)
          ### Bản chất
          (Giải thích bản chất, cấu tạo, cơ chế phản ứng)
          (Và các mục kiến thức khác nếu có như: Tính chất hóa học, Tính chất vật lý, Ví dụ minh họa thực tế...)
        
        Với mỗi mục lớn (Khái niệm, Bản chất...), vui lòng viết chi tiết, khoa học, kèm đầy đủ phương trình phản ứng hóa học (thẻ HTML sub/sup) và ví dụ thực tế.
        
        ${sharedInstructions}`;
        break;
      }

      case 'summary_mindmap': {
        const uppercaseTitle = chapter.title.toUpperCase();
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Tổng hợp công thức, Quy tắc và Bảng tổng hợp kiến thức** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Loại chương trình: ${programTypeName}
        - Các bài học trong chương/chuyên đề này: ${lessonListStr}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Yêu cầu đặc biệt về cấu trúc tiêu đề (BẮT BUỘC):
        - Bắt đầu bằng tiêu đề lớn định dạng Heading 1:
          # IV - TỔNG HỢP KIẾN THỨC CHƯƠNG ${chapter.id}: ${uppercaseTitle} - HÓA HỌC ${grade} (KẾT NỐI TRI THỨC VỚI CUỘC SỐNG)
        - Tiếp theo, trình bày các nội dung con định dạng Heading 2:
          ## 1. CÁC CÔNG THỨC HÓA HỌC VÀ TOÁN HỌC QUAN TRỌNG TRONG CHƯƠNG
          (Liệt kê chi tiết các công thức toán học/hóa học, chú thích đại lượng và đơn vị)
          ## 2. CÁC QUY TẮC VÀ ĐỊNH LUẬT QUAN TRỌNG TRONG CHƯƠNG
          (Nêu rõ các định luật, quy tắc của chương, ví dụ định luật tác dụng khối lượng, quy tắc Van 't Hoff...)
          ## 3. BẢNG TỔNG HỢP KIẾN THỨC TRỌNG TÂM CHƯƠNG ${uppercaseTitle}
          (Bảng so sánh hệ thống hóa kiến thức trọng tâm dạng bảng Markdown)
        
        Lưu ý: TUYỆT ĐỐI KHÔNG ĐƯỢC tạo mục "Sơ đồ tư duy" (dạng văn bản hay bất kỳ dạng nào khác). Bỏ hoàn toàn mục này.
        
        ${sharedInstructions}`;
        break;
      }

      case 'exercises': {
        const uppercaseTitle = chapter.title.toUpperCase();
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy viết tài liệu ôn tập phần **Các dạng bài tập ôn tập tiêu biểu** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Loại chương trình: ${programTypeName}
        - Các bài học trong chương/chuyên đề này: ${lessonListStr}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Yêu cầu đặc biệt về nội dung và tiêu đề (BẮT BUỘC):
        - BẮT BUỘC tất cả các dạng bài tập, ví dụ, phương pháp giải phải được biên soạn chính xác theo nội dung và kiến thức của ${programTypeName} (gồm các bài học: ${lessonListStr}), tuyệt đối không được nhầm lẫn lấy nội dung bài tập của Chương trình cốt lõi khác.
        - Bắt đầu bằng tiêu đề lớn định dạng Heading 1:
          # V - TÀI LIỆU ÔN TẬP CHƯƠNG ${chapter.id}: ${uppercaseTitle} - HÓA HỌC ${grade} (KẾT NỐI TRI THỨC)
        - Tiếp theo là tiêu đề phụ Heading 1:
          # CÁC DẠNG BÀI TẬP ÔN TẬP TIÊU BIỂU
        - Trình bày mỗi dạng bài tập bắt đầu bằng tiêu đề dạng bài định dạng Heading 2:
          ## DẠNG [Số thứ tự]: [TÊN DẠNG BÀI]
          (Ví dụ: ## DẠNG 1: TÍNH TỐC ĐỘ TRUNG BÌNH CỦA PHẢN ỨNG HÓA HỌC)
        - Bên dưới mỗi dạng bài tập, hãy trình bày các phần nhỏ bắt đầu bằng Heading 3:
          ### 1. Dấu hiệu nhận biết dạng bài
          (Nêu các dấu hiệu đặc trưng để nhận biết đề bài thuộc dạng này)
          ### 2. Phương pháp giải chi tiết
          (Trình bày chi tiết các bước giải tổng quát từ Bước 1, Bước 2...)
          ### 3. Ví dụ mẫu minh họa
          (Đưa ra ít nhất 2 ví dụ mẫu có lời giải chi tiết và phương trình phản ứng cụ thể)
        
        Tuyệt đối không được đánh số thứ tự sai lệch hoặc dùng chung số thứ tự "1." cho các đề mục con dưới dạng bài.
        
        ${sharedInstructions}`;
        break;
      }

      case 'mistakes_tips': {
        const uppercaseTitle = chapter.title.toUpperCase();
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Các lỗi sai thường gặp, Mẹo ghi nhớ nhanh và Liên hệ thực tiễn** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Loại chương trình: ${programTypeName}
        - Các bài học trong chương/chuyên đề này: ${lessonListStr}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Yêu cầu đặc biệt về nội dung và tiêu đề (BẮT BUỘC):
        - BẮT BUỘC tất cả lỗi sai thường gặp, mẹo ghi nhớ và liên hệ thực tiễn phải được lấy chính xác từ kiến thức của ${programTypeName} (gồm các bài học: ${lessonListStr}), tuyệt đối không được nhầm lẫn lấy kiến thức từ Chương trình cốt lõi khác.
        - Bắt đầu bằng tiêu đề lớn định dạng Heading 1:
          # VI - CÁC LỖI SAI THƯỜNG GẶP, MẸO GHI NHỚ NHANH VÀ LIÊN HỆ THỰC TIỄN - CHƯƠNG ${chapter.id}: ${uppercaseTitle} (HÓA HỌC ${grade} - KẾT NỐI TRI THỨC)
        - Tiếp theo, trình bày các nội dung con định dạng Heading 2:
          ## 1. CÁC LỖI SAI THƯỜNG GẶP CỦA HỌC SINH
          (Liệt kê các lỗi sai lý thuyết/tính toán hay gặp và cách khắc phục)
          ## 2. MẸO GHI NHỚ NHANH
          (Định dạng đoạn thơ hoặc mẹo ghi nhớ nhanh, bắt đầu bằng '**Mẹo ghi nhớ:**')
          ## 3. LIÊN HỆ THỰC TIỄN VÀ ỨNG DỤNG ĐỜI SỐNG
          (Các ứng dụng thực tế, giải thích hiện tượng hóa học đời sống liên quan)
        
        ${sharedInstructions}`;
        break;
      }

      case 'tests_checklist': {
        const uppercaseTitle = chapter.title.toUpperCase();
        prompt = `Bạn là giáo viên Hóa học THPT biên soạn tài liệu ôn tập chương. Hãy biên soạn phần **Câu hỏi tự kiểm tra tự luận/trắc nghiệm, Checklist tự đánh giá và Tóm tắt chương** cho chương sau:
        - Tên chương: ${chapter.title} (Chương ${chapter.id})
        - Lớp: Hóa học ${grade}
        - Loại chương trình: ${programTypeName}
        - Các bài học trong chương/chuyên đề này: ${lessonListStr}
        - Bộ sách: Kết nối tri thức với cuộc sống
        
        Yêu cầu đặc biệt về nội dung và tiêu đề (BẮT BUỘC):
        - BẮT BUỘC tất cả hệ thống câu hỏi, bài tập trắc nghiệm/tự luận, checklist và tóm tắt chương phải được xây dựng chính xác dựa trên kiến thức của ${programTypeName} (gồm các bài học: ${lessonListStr}), tuyệt đối không được nhầm lẫn lấy kiến thức từ Chương trình cốt lõi khác.
        - Bắt đầu bằng tiêu đề lớn định dạng Heading 1:
          # VII - HỆ THỐNG CÂU HỎI VÀ TÀI LIỆU ÔN TẬP CHƯƠNG ${chapter.id}: ${uppercaseTitle} - HÓA HỌC ${grade} (KẾT NỐI TRI THỨC)
        - Tiếp theo là tiêu đề phụ định dạng Heading 2:
          ## PHẦN 1: HỆ THỐNG CÂU HỎI TỰ KIỂM TRA ĐÁNH GIÁ NĂNG LỰC
        - Trình bày câu hỏi theo các mức độ định dạng Heading 3:
          ### I. Mức độ Nhận biết
          (Ít nhất 5 câu hỏi trắc nghiệm A, B, C, D về nội dung chương này. Tô đỏ phương án đúng bằng <span style="color:red">A. Đáp án</span>. Mỗi phương án bắt đầu ở dòng mới sát lề trái, tuyệt đối không dùng gạch đầu dòng hay dấu sao.)
          ### II. Mức độ Thông hiểu
          (Ít nhất 3 câu tự luận kèm Gợi ý trả lời chi tiết về nội dung chương này. Gợi ý trả lời viết xuống dòng bắt đầu bằng "Gợi ý: ...", bọc từ khóa đỏ bằng <span style="color:red">...</span>)
          ### III. Mức độ Vận dụng và Vận dụng cao
          (Ít nhất 2 bài tập tính toán có hướng dẫn giải về nội dung chương này. Hướng dẫn giải viết xuống dòng bắt đầu bằng "Hướng dẫn giải: ...", bọc đáp số đỏ bằng <span style="color:red">...</span>)
        - Tiếp theo là phần tự đánh giá định dạng Heading 2:
          ## PHẦN 2: CHECKLIST TỰ ĐÁNH GIÁ KIẾN THỨC
          (Bảng tự đánh giá với các cột: Nội dung kiến thức, Đã vững, Cần ôn lại, Ghi chú)
        - Tiếp theo là phần tóm tắt chương định dạng Heading 2:
          ## PHẦN 3: TÓM TẮT CHƯƠNG ${chapter.id} - ${uppercaseTitle}
          (Đoạn văn ngắn khái quát tinh thần của cả chương)
        
        YÊU CẦU BẮT BUỘC VỀ DẤU TIẾNG VIỆT VÀ ĐỊNH DẠNG:
        - VIẾT HOÀN TOÀN BẰNG TIẾNG VIỆT CHUẨN CÓ ĐẦY ĐỦ DẤU (Ví dụ: phải viết 'Trong phản ứng', 'chất nào là chất khử', tuyệt đối không được viết không dấu kiểu 'Trong phan ung', 'chat nao la chat khu'). Quy định này áp dụng nghiêm ngặt cho tất cả các câu hỏi trắc nghiệm, tự luận và tóm tắt chương.
        - Định dạng trắc nghiệm: CỰC KỲ QUAN TRỌNG, BẮT BUỘC từng phương án A., B., C., D. phải được viết ở các DÒNG RIÊNG BIỆT (xuống dòng mới hoàn toàn cho mỗi phương án, không được viết liền dòng với câu hỏi hay viết chung một dòng). Tuyệt đối KHÔNG ĐƯỢC đặt các ký tự gạch đầu dòng (*, -, •) ở trước chữ cái phương án.
          Ví dụ viết đúng:
          Câu 1: Nguyên tố nào là kim loại?
          A. Natri
          <span style="color:red">B. Clo</span>
          C. Oxi
          D. Nito
        - Định dạng tự luận/vận dụng: Phần "Gợi ý:" và "Hướng dẫn giải:" phải được xuống dòng mới riêng biệt ngay bên dưới câu hỏi/đề bài, không được viết liền dòng với câu hỏi.
        
        ${sharedInstructions}`;
        break;
      }

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
  const { grade, chapterId, markdownContent, programType = 'standard' } = req.body;

  if (!markdownContent) {
    return res.status(400).json({ error: "Thiếu nội dung tài liệu để xuất." });
  }

  const targetProgram = curriculum[programType] ? programType : 'standard';
  const gradeData = curriculum[targetProgram]?.[grade];
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
