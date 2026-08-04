// Detailed curriculum for Chemistry Grade 10, 11, 12 - bộ Kết nối tri thức với cuộc sống
// Divided into "standard" (Chương trình cốt lõi) and "topics" (Chuyên đề học tập)
const curriculum = {
  standard: {
    10: {
      title: "Hóa học Lớp 10",
      chapters: [
        {
          id: 1,
          title: "Cấu tạo nguyên tử",
          lessons: [
            "Bài 1: Thành phần của nguyên tử",
            "Bài 2: Nguyên tố hóa học",
            "Bài 3: Cấu trúc lớp vỏ electron nguyên tử"
          ]
        },
        {
          id: 2,
          title: "Bảng tuần hoàn các nguyên tố hóa học và định luật tuần hoàn",
          lessons: [
            "Bài 5: Cấu tạo của bảng tuần hoàn các nguyên tố hóa học",
            "Bài 6: Xu hướng biến đổi một số tính chất của nguyên tử các nguyên tố trong một chu kì và trong một nhóm",
            "Bài 7: Xu hướng biến đổi thành phần và một số tính chất của hợp chất trong một chu kì",
            "Bài 8: Định luật tuần hoàn. Ý nghĩa của bảng tuần hoàn các nguyên tố hóa học"
          ]
        },
        {
          id: 3,
          title: "Liên kết hóa học",
          lessons: [
            "Bài 10: Quy tắc octet",
            "Bài 11: Liên kết ion",
            "Bài 12: Liên kết cộng hóa trị",
            "Bài 13: Liên kết hydrogen và tương tác van der Waals"
          ]
        },
        {
          id: 4,
          title: "Phản ứng oxi hóa - khử",
          lessons: [
            "Bài 15: Phản ứng oxi hóa - khử"
          ]
        },
        {
          id: 5,
          title: "Năng lượng hóa học",
          lessons: [
            "Bài 17: Biến thiên enthalpy trong các phản ứng hóa học"
          ]
        },
        {
          id: 6,
          title: "Tốc độ phản ứng",
          lessons: [
            "Bài 19: Tốc độ phản ứng"
          ]
        },
        {
          id: 7,
          title: "Nguyên tố nhóm halogen",
          lessons: [
            "Bài 21: Nhóm halogen",
            "Bài 22: Hydrogen halide. Muối halide"
          ]
        }
      ]
    },
    11: {
      title: "Hóa học Lớp 11",
      chapters: [
        {
          id: 1,
          title: "Cân bằng hóa học",
          lessons: [
            "Bài 1: Khái niệm về cân bằng hoá học",
            "Bài 2: Cân bằng trong dung dịch nước"
          ]
        },
        {
          id: 2,
          title: "Nitrogen – Sulfur",
          lessons: [
            "Bài 4: Nitrogen",
            "Bài 5: Ammonia – Muối ammonium",
            "Bài 6: Một số hợp chất của nitrogen với oxygen",
            "Bài 7: Sulfur và sulfur dioxide",
            "Bài 8: Sulfuric acid và muối sulfate"
          ]
        },
        {
          id: 3,
          title: "Đại cương về hóa học hữu cơ",
          lessons: [
            "Bài 10: Hợp chất hữu cơ và hoá học hữu cơ",
            "Bài 11: Phương pháp tách biệt và tinh chế hợp chất hữu cơ",
            "Bài 12: Công thức phân tử hợp chất hữu cơ",
            "Bài 13: Cấu tạo hoá học hợp chất hữu cơ"
          ]
        },
        {
          id: 4,
          title: "Hydrocarbon",
          lessons: [
            "Bài 15: Alkane",
            "Bài 16: Hydrocarbon không no",
            "Bài 17: Arene (Hydrocarbon thơm)"
          ]
        },
        {
          id: 5,
          title: "Dẫn xuất halogen – Alcohol – Phenol",
          lessons: [
            "Bài 19: Dẫn xuất halogen",
            "Bài 20: Alcohol",
            "Bài 21: Phenol"
          ]
        },
        {
          id: 6,
          title: "Hợp chất Carbonyl – Carboxylic acid",
          lessons: [
            "Bài 23: Hợp chất carbonyl",
            "Bài 24: Carboxylic acid"
          ]
        }
      ]
    },
    12: {
      title: "Hóa học Lớp 12",
      chapters: [
        {
          id: 1,
          title: "Ester – Lipid",
          lessons: [
            "Bài 1: Ester – Lipid",
            "Bài 2: Xà phòng và chất giặt rửa"
          ]
        },
        {
          id: 2,
          title: "Carbohydrate",
          lessons: [
            "Bài 4: Giới thiệu về carbohydrate. Glucose và fructose",
            "Bài 5: Saccharose và maltose",
            "Bài 6: Tinh bột và cellulose"
          ]
        },
        {
          id: 3,
          title: "Hợp chất chứa nitrogen",
          lessons: [
            "Bài 8: Amine",
            "Bài 9: Amino acid và peptide",
            "Bài 10: Protein và enzyme"
          ]
        },
        {
          id: 4,
          title: "Polymer",
          lessons: [
            "Bài 12: Đại cương về polymer",
            "Bài 13: Vật liệu polymer"
          ]
        },
        {
          id: 5,
          title: "Pin điện và điện phân",
          lessons: [
            "Bài 15: Thế điện cực và nguồn điện hóa học",
            "Bài 16: Điện phân"
          ]
        },
        {
          id: 6,
          title: "Đại cương về kim loại",
          lessons: [
            "Bài 18: Cấu tạo và liên kết trong tinh thể kim loại",
            "Bài 19: Tính chất vật lí và tính chất hóa học của kim loại",
            "Bài 20: Kim loại trong tự nhiên và phương pháp tách kim loại",
            "Bài 21: Hợp kim",
            "Bài 22: Sự ăn mòn kim loại"
          ]
        },
        {
          id: 7,
          title: "Nguyên tố nhóm IA và nhóm IIA",
          lessons: [
            "Bài 24: Nguyên tố nhóm IA",
            "Bài 25: Nguyên tố nhóm IIA"
          ]
        },
        {
          id: 8,
          title: "Sơ lược về dãy kim loại chuyển tiếp thứ nhất và phức chất",
          lessons: [
            "Bài 27: Đại cương về kim loại chuyển tiếp dãy thứ nhất",
            "Bài 28: Sơ lược về phức chất",
            "Bài 29: Một số tính chất và ứng dụng của phức chất"
          ]
        }
      ]
    }
  },
  topics: {
    10: {
      title: "Chuyên đề Học tập Hóa học 10",
      chapters: [
        {
          id: 1,
          title: "Cơ sở hóa học",
          lessons: [
            "Bài 1: Liên kết hóa học",
            "Bài 2: Phản ứng hạt nhân",
            "Bài 3: Năng lượng hoạt hóa của phản ứng hóa học",
            "Bài 4: Entropy và biến thiên năng lượng tự do Gibbs"
          ]
        },
        {
          id: 2,
          title: "Hóa học trong việc phòng chống cháy, nổ",
          lessons: [
            "Bài 5: Sơ lược về phản ứng cháy, nổ",
            "Bài 6: Điểm chớp cháy – Nhiệt độ ngọn lửa – Nhiệt độ tự bốc cháy",
            "Bài 7: Hóa học về phản ứng cháy, nổ",
            "Bài 8: Phòng chống cháy, nổ"
          ]
        },
        {
          id: 3,
          title: "Thực hành hóa học và công nghệ thông tin",
          lessons: [
            "Bài 9: Thực hành vẽ cấu trúc phân tử",
            "Bài 10: Thực hành thí nghiệm hóa học ảo",
            "Bài 11: Thực hành tính tham số cấu trúc và năng lượng"
          ]
        }
      ]
    },
    11: {
      title: "Chuyên đề Học tập Hóa học 11",
      chapters: [
        {
          id: 1,
          title: "Phân bón",
          lessons: [
            "Bài 1: Giới thiệu chung về phân bón",
            "Bài 2: Phân bón vô cơ",
            "Bài 3: Phân bón hữu cơ"
          ]
        },
        {
          id: 2,
          title: "Trải nghiệm, thực hành hóa học hữu cơ",
          lessons: [
            "Bài 4: Tách tinh dầu từ các nguồn thảo mộc tự nhiên",
            "Bài 5: Chuyển hóa chất béo thành xà phòng",
            "Bài 6: Điều chế glucosamine hydrochloride từ vỏ tôm"
          ]
        },
        {
          id: 3,
          title: "Dầu mỏ và chế biến dầu mỏ",
          lessons: [
            "Bài 7: Nguồn gốc dầu mỏ. Thành phần và phân loại dầu mỏ",
            "Bài 8: Chế biến dầu mỏ",
            "Bài 9: Ngành sản xuất dầu mỏ trên thế giới và ở Việt Nam"
          ]
        }
      ]
    },
    12: {
      title: "Chuyên đề Học tập Hóa học 12",
      chapters: [
        {
          id: 1,
          title: "Cơ chế phản ứng trong hóa học hữu cơ",
          lessons: [
            "Bài 1: Đại cương về cơ chế phản ứng",
            "Bài 2: Cơ chế phản ứng thế",
            "Bài 3: Cơ chế phản ứng cộng"
          ]
        },
        {
          id: 2,
          title: "Trải nghiệm, thực hành hóa học vô cơ",
          lessons: [
            "Bài 4: Tái chế kim loại",
            "Bài 5: Công nghiệp silicate",
            "Bài 6: Xử lí nước sinh hoạt"
          ]
        },
        {
          id: 3,
          title: "Một số vấn đề cơ bản về phức chất",
          lessons: [
            "Bài 7: Giới thiệu về phức chất",
            "Bài 8: Liên kết và cấu tạo của phức chất",
            "Bài 9: Vai trò và ứng dụng của phức chất"
          ]
        }
      ]
    }
  }
};

module.exports = curriculum;
