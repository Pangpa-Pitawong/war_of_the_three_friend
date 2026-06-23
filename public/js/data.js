// ─── Character Data with Thai Descriptions ───────────────────────────────────
window.CHAR_DATA = {
  caocao: {
    nameTh: 'เฉาเชา', nameEn: 'Cao Cao', nameZh: '曹操',
    kingdom: 'WEI', hp: 4, difficulty: 4,
    image: '/GeneralCard/WEI/Cao Cao.png',
    lore: 'นายกรัฐมนตรีผู้ทรงอำนาจแห่งแคว้นเว่ย นักกลยุทธ์ กวี และผู้นำทัพผู้ยิ่งใหญ่',
    skills: [
      {
        name: 'วีรบุรุษผู้ทรยศ', nameEn: 'Jian Xiong (奸雄)',
        desc: 'เมื่อเฉาเชาสูญเสีย HP จากการโจมตี สามารถเก็บการ์ด 1 ใบจากผู้โจมตีได้ทันที'
      },
      {
        name: 'คุ้มกันจักรพรรดิ', nameEn: 'Hu Jia (护驾)',
        desc: 'เมื่อถูกโจมตี ผู้ภักดีที่อยู่ในระยะสามารถเล่นการ์ดหลบหลีกแทนเฉาเชาได้'
      }
    ]
  },
  simayi: {
    nameTh: 'ซือหม่าอี้', nameEn: 'Sima Yi', nameZh: '司马懿',
    kingdom: 'WEI', hp: 3, difficulty: 4,
    image: '/GeneralCard/WEI/Sima Yi.png',
    lore: 'นักยุทธศาสตร์ลึกลับแห่งแคว้นเว่ย บรรพบุรุษของราชวงศ์จิ้น',
    skills: [
      {
        name: 'อัจฉริยะลี้ลับ', nameEn: 'Gui Cai (鬼才)',
        desc: 'เมื่อผู้เล่นคนใดใช้การ์ดกล หรือตัดสินในช่วงวิเคราะห์ ซือหม่าอี้สามารถทิ้งการ์ดเพื่อเปลี่ยนผลการตัดสินได้'
      },
      {
        name: 'โต้กลับ', nameEn: 'Fan Kui (反馈)',
        desc: 'เมื่อซือหม่าอี้สูญเสีย HP สามารถสังเกตไพ่บนสุดของผู้โจมตีและเลือกเก็บ 1 ใบได้'
      }
    ]
  },
  zhangliao: {
    nameTh: 'จางเหลียว', nameEn: 'Zhang Liao', nameZh: '张辽',
    kingdom: 'WEI', hp: 4, difficulty: 2,
    image: '/GeneralCard/WEI/Zhang Liao.png',
    lore: 'แม่ทัพผู้กล้าหาญแห่งเว่ย ผู้เอาชนะซุนฉวนที่สมรภูมิเหอเฝย',
    skills: [
      {
        name: 'จู่โจมสายฟ้า', nameEn: 'Tu Xi (突袭)',
        desc: 'ระยะโจมตีของจางเหลียวเพิ่มขึ้น 1 และสามารถโจมตีผู้เล่นที่ไม่มีไพ่ในมือโดยไม่ต้องเสียการ์ด'
      }
    ]
  },
  xiahou: {
    nameTh: 'เซี่ยโหวตุน', nameEn: 'Xiahou Dun', nameZh: '夏侯惇',
    kingdom: 'WEI', hp: 4, difficulty: 2,
    image: '/GeneralCard/WEI/Xiahou Dun.png',
    lore: 'ขุนพลผู้กล้าหาญที่สุดของเฉาเชา ผู้กินลูกตาตัวเองหลังถูกยิง',
    skills: [
      {
        name: 'เด็ดเดี่ยว', nameEn: 'Gang Lie (刚烈)',
        desc: 'เมื่อถูกโจมตีและไม่ได้หลบ สามารถทิ้งไพ่เพื่อโจมตีกลับผู้โจมตีทันทีด้วยความเสียหาย 1 จุด'
      }
    ]
  },
  xuzhu: {
    nameTh: 'ซวีจู้', nameEn: 'Xu Zhu', nameZh: '许褚',
    kingdom: 'WEI', hp: 4, difficulty: 2,
    image: '/GeneralCard/WEI/Xu Zhu.png',
    lore: 'ทหารคู่ใจแห่งเฉาเชา ผู้มีพละกำลังมหาศาลเปรียบดังวัวบ้า',
    skills: [
      {
        name: 'ถอดเสื้อรบ', nameEn: 'Luo Yi (裸衣)',
        desc: 'ในช่วงออกไพ่ ซวีจู้สามารถทิ้งไพ่ 2 ใบเพื่อเพิ่มความเสียหายของการโจมตีเป็น 2 จุดในตานั้น (ต้องไม่ติดอาวุธ)'
      }
    ]
  },
  zhenji: {
    nameTh: 'เจินจี', nameEn: 'Zhen Ji', nameZh: '甄姬',
    kingdom: 'WEI', hp: 3, difficulty: 3,
    image: '/GeneralCard/WEI/Zhen Ji.png',
    lore: 'นางสนมผู้งดงามที่สุดแห่งแคว้นเว่ย มารดาของจักรพรรดิเฉาหรุย',
    skills: [
      {
        name: 'เทพธิดาแม่น้ำลั่ว', nameEn: 'Luo Shen (洛神)',
        desc: 'ในช่วงเริ่มตา สังเกตไพ่บนสุดของกองไพ่ หากเป็นสีดำให้เก็บได้ ทำซ้ำจนได้ไพ่สีแดง'
      },
      {
        name: 'เสน่ห์ล้างเมือง', nameEn: 'Qing Guo (倾国)',
        desc: 'สามารถใช้ไพ่ดำแทนไพ่หลบหลีกได้'
      }
    ]
  },
  guojia: {
    nameTh: 'กัวเจีย', nameEn: 'Guo Jia', nameZh: '郭嘉',
    kingdom: 'WEI', hp: 3, difficulty: 4,
    image: '/GeneralCard/WEI/Guo Jia.png',
    lore: 'ที่ปรึกษาอัจฉริยะของเฉาเชา ผู้สิ้นชีพก่อนวัยอันควร',
    skills: [
      {
        name: 'ฟ้าอิจฉา', nameEn: 'Tian Du (天妒)',
        desc: 'เมื่อกัวเจียสูญเสีย HP ให้สังเกตไพ่บนสุดเท่ากับจำนวน HP ที่สูญเสีย หากแต่ละใบมีชนิดไพ่ต่างกัน ให้เก็บทั้งหมด'
      },
      {
        name: 'แผนมรดก', nameEn: 'Yi Ji (遗计)',
        desc: 'เมื่อกัวเจียสิ้น สามารถแจกไพ่ 2 ใบให้ผู้เล่นที่เลือกได้'
      }
    ]
  },
  yuejin: {
    nameTh: 'เยว่จิน', nameEn: 'Yue Jin', nameZh: '乐进',
    kingdom: 'WEI', hp: 4, difficulty: 2,
    image: '/GeneralCard/WEI/Yue Jin.png',
    lore: 'นายทัพกล้าหาญแห่งเว่ย หนึ่งในห้านายทัพชั้นยอดของเฉาเชา',
    skills: [
      {
        name: 'กล้าบุกหน้า', nameEn: 'Yong Wang (勇往)',
        desc: 'เมื่อโจมตีสำเร็จ (เป้าหมายไม่หลบ) สามารถทิ้งการ์ดจากมือของเป้าหมาย 1 ใบได้'
      }
    ]
  },
  liubei: {
    nameTh: 'หลิวเป้ย', nameEn: 'Liu Bei', nameZh: '刘备',
    kingdom: 'SHU', hp: 4, difficulty: 3,
    image: '/GeneralCard/SHU/Liu Bei.png',
    lore: 'จักรพรรดิแห่งจ็อก หลานเหลนของจักรพรรดิฮั่น ผู้สถาปนาแคว้นสู่',
    skills: [
      {
        name: 'คุณธรรม', nameEn: 'Ren De (仁德)',
        desc: 'ในช่วงออกไพ่ หลิวเป้ยสามารถให้ไพ่ใดก็ได้แก่ผู้เล่นคนอื่น เมื่อให้ไพ่ครบ 2 ใบในตาเดียว รักษา HP 1 จุด'
      },
      {
        name: 'กระตุ้นนายพล', nameEn: 'Ji Jiang (激将)',
        desc: 'เมื่อต้องการโจมตี สามารถขอให้นายพลคนอื่นเล่นไพ่โจมตีแทนได้ ถ้าไม่มีใครช่วย หลิวเป้ยสูญเสีย 1 HP'
      }
    ]
  },
  guanyu: {
    nameTh: 'กวนอู', nameEn: 'Guan Yu', nameZh: '关羽',
    kingdom: 'SHU', hp: 4, difficulty: 2,
    image: '/GeneralCard/SHU/Guan Yu.png',
    lore: 'เทพเจ้าแห่งสงครามและความซื่อสัตย์ ผู้ถือง้าวมังกรเขียว',
    skills: [
      {
        name: 'นักรบศักดิ์สิทธิ์', nameEn: 'Wu Sheng (武圣)',
        desc: 'กวนอูสามารถใช้ไพ่ทุกสีแทนไพ่โจมตีได้ (ไม่จำกัดเฉพาะไพ่โจมตีจริง)'
      },
      {
        name: 'ความซื่อสัตย์สูงสุด', nameEn: 'Yi Jue (义绝)',
        desc: 'เมื่อช่วยรักษาผู้เล่นคนอื่น กวนอูได้รับ HP 1 จุดด้วย'
      }
    ]
  },
  zhangfei: {
    nameTh: 'จางเฟย', nameEn: 'Zhang Fei', nameZh: '张飞',
    kingdom: 'SHU', hp: 4, difficulty: 2,
    image: '/GeneralCard/SHU/Zhang Fei.png',
    lore: 'นักรบผู้ดุดันแห่งสู่ ผู้พี่น้องสาบานเลือดกับหลิวเป้ยและกวนอู',
    skills: [
      {
        name: 'คำราม', nameEn: 'Pao Xiao (咆哮)',
        desc: 'จางเฟยสามารถใช้ไพ่ทุกสีแทนไพ่หลบหลีกได้'
      },
      {
        name: 'ปล่อยด้วยยุติธรรม', nameEn: 'Yi Shi (义释)',
        desc: 'ในช่วงจบตา ถ้าจางเฟยมีไพ่เกิน 4 ใบ สามารถเลือกให้ไพ่แก่ผู้เล่นอื่นแทนการทิ้ง'
      }
    ]
  },
  zhaoyun: {
    nameTh: 'เจาหยุน', nameEn: 'Zhao Yun', nameZh: '赵云',
    kingdom: 'SHU', hp: 4, difficulty: 1,
    image: '/GeneralCard/SHU/Zhao Yun.png',
    lore: 'ขุนพลผู้กล้าที่สุดแห่งสู่ ผู้บุกทะลวงทัพข้าศึกนับแสนคนเดียวเพื่อช่วยโอรส',
    skills: [
      {
        name: 'ใจสิงห์', nameEn: 'Long Dan (龙胆)',
        desc: 'เจาหยุนสามารถใช้ไพ่โจมตีแทนไพ่หลบหลีก และใช้ไพ่หลบหลีกแทนไพ่โจมตีได้'
      }
    ]
  },
  zhuge: {
    nameTh: 'จูกัดเหลียง', nameEn: 'Zhuge Liang', nameZh: '诸葛亮',
    kingdom: 'SHU', hp: 3, difficulty: 5,
    image: '/GeneralCard/SHU/Zhuge Liang.png',
    lore: 'อัครมหาเสนาบดีแห่งสู่ อัจฉริยะยุทธศาสตร์ ผู้คิดกลแปดทิศ ตัวพัดขนนกขาว',
    skills: [
      {
        name: 'ดูดาว', nameEn: 'Guan Xing (观星)',
        desc: 'ในช่วงเริ่มตา สังเกตไพ่บนสุด 5 ใบ เลือกเก็บได้ไม่เกิน HP ปัจจุบัน แล้ววางส่วนที่เหลือในลำดับที่ต้องการ'
      },
      {
        name: 'กลวิธีเมืองร้าง', nameEn: 'Kong Cheng (空城)',
        desc: 'เมื่อจูกัดเหลียงไม่มีไพ่ในมือ ทุกการโจมตีต่อเขาถูกยกเลิกโดยอัตโนมัติ'
      }
    ]
  },
  machao: {
    nameTh: 'หม่าเฉา', nameEn: 'Ma Chao', nameZh: '马超',
    kingdom: 'SHU', hp: 4, difficulty: 2,
    image: '/GeneralCard/SHU/Ma Chao.png',
    lore: 'แม่ทัพม้าผู้กล้าหาญ บุตรชายหม่าเถิง ผู้ครองอาวุธหอกและง้าว',
    skills: [
      {
        name: 'ฝีมือขี่ม้า', nameEn: 'Ma Shu (马术)',
        desc: 'ระยะโจมตีของหม่าเฉาเพิ่มขึ้น +1 ตลอดเวลา'
      },
      {
        name: 'ทหารม้าเหล็ก', nameEn: 'Tie Ji (铁骑)',
        desc: 'เมื่อโจมตีสำเร็จ (เป้าหมายไม่หลบ) สามารถทิ้งอุปกรณ์ 1 ชิ้นจากเป้าหมายได้'
      }
    ]
  },
  huangyy: {
    nameTh: 'หวงเยว่อิง', nameEn: 'Huang Yueying', nameZh: '黄月英',
    kingdom: 'SHU', hp: 3, difficulty: 3,
    image: '/GeneralCard/SHU/Huang Yueying.png',
    lore: 'ภรรยาอัจฉริยะของจูกัดเหลียง นักประดิษฐ์หุ่นยนต์ไม้และอุปกรณ์สงคราม',
    skills: [
      {
        name: 'รวบรวมปัญญา', nameEn: 'Ji Zhi (集智)',
        desc: 'เมื่อใช้ไพ่กล (ที่ไม่ใช่อุปกรณ์) ให้หยิบไพ่ 1 ใบ'
      },
      {
        name: 'พรสวรรค์พิเศษ', nameEn: 'Qi Cai (奇才)',
        desc: 'ระยะสำหรับใช้ไพ่กลของหวงเยว่อิงไม่มีข้อจำกัด'
      }
    ]
  },
  ladygan: {
    nameTh: 'นางกาน', nameEn: 'Lady Gan', nameZh: '甘夫人',
    kingdom: 'SHU', hp: 3, difficulty: 3,
    image: '/GeneralCard/SHU/Lady Gan.png',
    lore: 'มเหสีของหลิวเป้ย มารดาของหลิวฉาน ผู้มีความงามและปัญญา',
    skills: [
      {
        name: 'สุภาพเรียบร้อย', nameEn: 'Shu Shen (淑慎)',
        desc: 'เมื่อถูกกำหนดเป็นเป้าหมายของไพ่กล สามารถแสดงไพ่ในมือทั้งหมดเพื่อยกเลิกผลนั้น (ใช้ได้ครั้งเดียวต่อตา)'
      },
      {
        name: 'ฝันร้าย', nameEn: 'Meng Yan (梦魇)',
        desc: 'ในช่วงเริ่มตา สามารถทิ้งการ์ดเพื่อป้องกันการตัดสินลบในช่วงวิเคราะห์'
      }
    ]
  },
  sunquan: {
    nameTh: 'ซุนฉวน', nameEn: 'Sun Quan', nameZh: '孙权',
    kingdom: 'WU', hp: 4, difficulty: 3,
    image: '/GeneralCard/WU/Sun Quan.png',
    lore: 'จักรพรรดิแห่งอู๋ ผู้สถาปนาแคว้นตะวันออก บุตรชายซุนเจียน',
    skills: [
      {
        name: 'ถ่วงดุลอำนาจ', nameEn: 'Zhi Heng (制衡)',
        desc: 'ในช่วงออกไพ่ ทิ้งไพ่จากมือได้ทุกจำนวนแล้วหยิบใหม่เท่าจำนวนที่ทิ้ง (ใช้ครั้งเดียวต่อตา)'
      },
      {
        name: 'ช่วยเหลือ', nameEn: 'Jiu Yuan (救援)',
        desc: 'เมื่อผู้เล่นอื่นได้รับ HP เพิ่มจากไพ่เพอช์ ซุนฉวนสามารถหยิบไพ่เพิ่ม 1 ใบ'
      }
    ]
  },
  zhouyu: {
    nameTh: 'โจวอี๋', nameEn: 'Zhou Yu', nameZh: '周瑜',
    kingdom: 'WU', hp: 3, difficulty: 4,
    image: '/GeneralCard/WU/Zhou Yu.png',
    lore: 'แม่ทัพผู้งดงามแห่งอู๋ ผู้วางกลอัคคีที่เฉอปี้ บัญชาการกองทัพอู๋ในสมรภูมิแผ่นดิน',
    skills: [
      {
        name: 'ท่าทางวีรบุรุษ', nameEn: 'Ying Zi (英姿)',
        desc: 'โจวอี๋หยิบไพ่เพิ่ม 1 ใบในช่วงหยิบไพ่ (หยิบ 3 ใบแทน 2 ใบ)'
      },
      {
        name: 'สายลับย้อน', nameEn: 'Fan Jian (反间)',
        desc: 'ในช่วงออกไพ่ ให้ไพ่แก่ผู้เล่นคนอื่น 1 ใบ เขาต้องเดาสีไพ่ หากเดาผิดสูญเสีย 1 HP'
      }
    ]
  },
  huanggai: {
    nameTh: 'หวงไก้', nameEn: 'Huang Gai', nameZh: '黄盖',
    kingdom: 'WU', hp: 4, difficulty: 2,
    image: '/GeneralCard/WU/Huang Gai.png',
    lore: 'แม่ทัพผู้อาวุโสของอู๋ เสนอแผนทรมานตัวเองเพื่อแทรกซึมค่ายเฉาเชา',
    skills: [
      {
        name: 'ทรมานตัวเอง', nameEn: 'Ku Rou (苦肉)',
        desc: 'ในช่วงออกไพ่ หวงไก้สามารถสูญเสีย HP 1-2 จุดโดยสมัครใจ แล้วหยิบไพ่เพิ่ม 2 เท่าของ HP ที่สูญเสีย'
      }
    ]
  },
  luxun: {
    nameTh: 'หลู่ซวิน', nameEn: 'Lu Xun', nameZh: '陆逊',
    kingdom: 'WU', hp: 3, difficulty: 4,
    image: '/GeneralCard/WU/Lu Xun.png',
    lore: 'อัครมหาเสนาบดีผู้อ่อนน้อมแห่งอู๋ ผู้ใช้อัคคีเผาค่ายหลิวเป้ยในสมรภูมิอี๋หลิง',
    skills: [
      {
        name: 'ถ่อมตัว', nameEn: 'Qian Xun (谦逊)',
        desc: 'หลู่ซวินไม่สามารถถูกเลือกเป็นเป้าหมายของไพ่กลที่ต้องระบุเป้าหมาย'
      },
      {
        name: 'ค่ายเชื่อมต่อ', nameEn: 'Lian Ying (连营)',
        desc: 'เมื่อหลู่ซวินทิ้งไพ่ ให้หยิบไพ่เท่าจำนวนที่ทิ้ง'
      }
    ]
  },
  sunss: {
    nameTh: 'ซุนซ่างเซียง', nameEn: 'Sun Shangxiang', nameZh: '孙尚香',
    kingdom: 'WU', hp: 3, difficulty: 3,
    image: '/GeneralCard/WU/Sun Shangxiang.png',
    lore: 'เจ้าหญิงผู้กล้าหาญแห่งอู๋ พระชายาหลิวเป้ย นักรบหญิงผู้เชี่ยวชาญอาวุธ',
    skills: [
      {
        name: 'อภิเษกสมรส', nameEn: 'Jie Yin (结姻)',
        desc: 'ในช่วงออกไพ่ ทิ้งไพ่ 2 ใบเพื่อเลือกผู้ชายในเกม ย้ายไปอยู่ด้านข้างเขาและทั้งคู่รักษา 1 HP'
      },
      {
        name: 'นางมังกร', nameEn: 'Xiao Ji (枭姬)',
        desc: 'เมื่อซุนซ่างเซียงติดอุปกรณ์ม้า ให้หยิบไพ่ 2 ใบ'
      }
    ]
  },
  lvmeng: {
    nameTh: 'หลู่เมิ่ง', nameEn: 'Lv Meng', nameZh: '吕蒙',
    kingdom: 'WU', hp: 4, difficulty: 3,
    image: '/GeneralCard/WU/Lv Meng.png',
    lore: 'แม่ทัพผู้เรียนรู้ไม่หยุดหย่อน ผู้โจมตีกวนอูจนถึงแก่ความตาย',
    skills: [
      {
        name: 'ควบคุมตัวเอง', nameEn: 'Ke Ji (克己)',
        desc: 'หากหลู่เมิ่งไม่โจมตีในช่วงออกไพ่ สามารถข้ามช่วงทิ้งไพ่และเก็บไพ่ได้ทุกใบ'
      },
      {
        name: 'โจมตีจิตใจ', nameEn: 'Gong Xin (攻心)',
        desc: 'เมื่อโจมตีสำเร็จ สามารถแสดงไพ่บนสุดของกองไพ่ หากเป็นสีแดงให้เป้าหมายทิ้งไพ่ 1 ใบ'
      }
    ]
  },
  ganning: {
    nameTh: 'กานหนิง', nameEn: 'Gan Ning', nameZh: '甘宁',
    kingdom: 'WU', hp: 4, difficulty: 2,
    image: '/GeneralCard/WU/Gan Ning.png',
    lore: 'โจรสลัดผู้กลับใจ นักรบผู้สวมเสื้อคลุมระฆัง ผู้บุกทะลวงค่ายข้าศึกนับร้อยด้วยทหาร 100 นาย',
    skills: [
      {
        name: 'โจมตีแบบไม่คาดคิด', nameEn: 'Qi Xi (奇袭)',
        desc: 'กานหนิงสามารถใช้ไพ่ดำแทนไพ่โจมตีได้'
      },
      {
        name: 'รุกเร็ว', nameEn: 'Li Chi (利驰)',
        desc: 'ในช่วงหยิบไพ่ กานหนิงสามารถหยิบไพ่จากมือของผู้เล่นที่อยู่ในระยะ 1 แทนกองไพ่ได้'
      }
    ]
  },
  daqiao: {
    nameTh: 'ต้าเฉียว', nameEn: 'Da Qiao', nameZh: '大乔',
    kingdom: 'WU', hp: 3, difficulty: 3,
    image: '/GeneralCard/WU/Da Qiao.png',
    lore: 'นางงามคู่ของซิ่าวเฉียว ภรรยาของซุนเซ่อ หนึ่งในสองนางงามแห่งเจียงตง',
    skills: [
      {
        name: 'ความงามระดับชาติ', nameEn: 'Guo Se (国色)',
        desc: 'สามารถใช้ไพ่โพแดงแทนไพ่ตัดสินไพ่สีดำ (ทำให้ไพ่กลส่วนใหญ่ไม่มีผล)'
      },
      {
        name: 'ร่อนเร่', nameEn: 'Liu Li (流离)',
        desc: 'เมื่อถูกโจมตี สามารถทิ้งการ์ด 1 ใบเพื่อย้ายการโจมตีไปยังผู้เล่นอื่นที่อยู่ในระยะได้'
      }
    ]
  },
  lvbu: {
    nameTh: 'หลู่ปู้', nameEn: 'Lv Bu', nameZh: '吕布',
    kingdom: 'QUN', hp: 4, difficulty: 3,
    image: '/GeneralCard/QUH/Lv Bu.png',
    lore: 'นักรบที่แข็งแกร่งที่สุดในยุคสามก๊ก ผู้ถือง้าวฟ้าและขี่ม้าชิวหยูอี้ ทรยศนายหลายครั้ง',
    skills: [
      {
        name: 'ไม่มีคู่แข่ง', nameEn: 'Wu Shuang (无双)',
        desc: 'เมื่อหลู่ปู้โจมตี เป้าหมายต้องใช้ไพ่หลบหลีก 2 ใบถึงจะหลบได้ และเมื่อถูกดวล สามารถใช้ไพ่โจมตีแทนไพ่โจมตีได้ 2 ครั้ง'
      },
      {
        name: 'บุกทะลวง', nameEn: 'Xian Zhen (陷阵)',
        desc: 'เมื่อหลู่ปู้ดวลกับใคร เขาสามารถโจมตีซ้ำได้ไม่จำกัดครั้งในการดวลนั้น'
      }
    ]
  },
  diaochan: {
    nameTh: 'เตียวเสี้ยน', nameEn: 'Diao Chan', nameZh: '貂蝉',
    kingdom: 'QUN', hp: 3, difficulty: 4,
    image: '/GeneralCard/QUH/Diao Chan.png',
    lore: 'นางฟ้าแห่งความงาม ผู้ยุยงให้หลู่ปู้และตงจัวแตกคอกัน หนึ่งในสี่นางงามแห่งประวัติศาสตร์จีน',
    skills: [
      {
        name: 'ยุยงแตกแยก', nameEn: 'Li Jian (离间)',
        desc: 'ในช่วงออกไพ่ ทิ้งไพ่ 1 ใบเพื่อกำหนดให้ผู้ชาย 2 คนดวลกัน โดยผู้แพ้สูญเสีย 1 HP'
      },
      {
        name: 'ดาวจันทร์ปิด', nameEn: 'Bi Yue (闭月)',
        desc: 'ในช่วงจบตา หยิบไพ่เพิ่ม 1 ใบ'
      }
    ]
  },
  huatuo: {
    nameTh: 'หัวถัว', nameEn: 'Hua Tuo', nameZh: '华佗',
    kingdom: 'QUN', hp: 3, difficulty: 2,
    image: '/GeneralCard/QUH/Hua Tuo.png',
    lore: 'แพทย์ผู้ยิ่งใหญ่ที่สุดในประวัติศาสตร์จีน ผู้คิดค้นยาสลบและการผ่าตัด',
    skills: [
      {
        name: 'กู้ฉุกเฉิน', nameEn: 'Jiu Ji (救急)',
        desc: 'สามารถใช้ไพ่แดงแทนไพ่เพอช์ได้'
      },
      {
        name: 'ถุงยาสีเขียว', nameEn: 'Qing Nang (青囊)',
        desc: 'ในช่วงออกไพ่ ทิ้งการ์ด 1 ใบเพื่อรักษาผู้เล่นคนใดก็ได้ 1 HP (ใช้ครั้งเดียวต่อตา)'
      }
    ]
  },
  huaxiong: {
    nameTh: 'หัวสยง', nameEn: 'Hua Xiong', nameZh: '华雄',
    kingdom: 'QUN', hp: 4, difficulty: 2,
    image: '/GeneralCard/QUH/Hua Xiong.png',
    lore: 'แม่ทัพที่กล้าหาญของตงจัว ผู้ถูกกวนอูสังหารขณะไวน์ยังร้อน',
    skills: [
      {
        name: 'บารมีเสือ', nameEn: 'Hu Wei (虎威)',
        desc: 'เมื่อโจมตีสำเร็จ ให้ผู้ถูกโจมตีอยู่ในสภาวะ "กลัว" 1 รอบ ไม่สามารถโจมตีได้'
      }
    ]
  },
  gongsuanzan: {
    nameTh: 'กงซุนจ้าน', nameEn: 'Gongsun Zan', nameZh: '公孙瓒',
    kingdom: 'QUN', hp: 4, difficulty: 2,
    image: '/GeneralCard/QUH/Gongsun Zan.png',
    lore: 'ผู้ปกครองแคว้นเหลียวตง ผู้บัญชาการหน่วยทหารม้าขาว เจ้านายเก่าของจ้าวหยุน',
    skills: [
      {
        name: 'ผู้ตามที่ซื่อสัตย์', nameEn: 'Yi Cong (义从)',
        desc: 'เมื่อมีผู้เล่นอื่นใช้ไพ่กลที่มีผลต่อทุกคน กงซุนจ้านสามารถทิ้งไพ่ 1 ใบเพื่อหลีกเลี่ยงผลนั้นได้'
      }
    ]
  },
  panfeng: {
    nameTh: 'พันเฝิง', nameEn: 'Pan Feng', nameZh: '潘凤',
    kingdom: 'QUN', hp: 4, difficulty: 1,
    image: '/GeneralCard/QUH/Pan Feng.png',
    lore: 'นายพลแห่งเกาานผู้ถูกหัวสยงสังหาร กลายเป็นมีมอินเทอร์เน็ตว่า "นายพลไร้ทักษะ"',
    skills: [
      {
        name: 'ทั่วไป', nameEn: 'Normal',
        desc: 'พันเฝิงไม่มีทักษะพิเศษ — แต่ก็หมายความว่าคาดเดายาก! เล่นไพ่ได้อิสระเต็มที่'
      }
    ]
  },
};

// ─── Card Data with Thai Descriptions ────────────────────────────────────────
window.CARD_DATA = {
  'Attack': {
    nameTh: 'โจมตี (杀)', nameEn: 'Attack', type: 'basic',
    color: '#c0392b',
    desc: 'โจมตีเป้าหมายในระยะ 1 ด้วยความเสียหาย 1 จุด เป้าหมายสามารถใช้ไพ่หลบหลีกได้',
    usage: 'เลือกผู้เล่นในระยะ → คลิก "ยืนยัน"',
    image: '/GameCard/BasicCard/Attack.png',
    limit: 1,
    tips: 'ปกติเล่นได้แค่ 1 ครั้งต่อตา (ยกเว้นใช้ไม้ซานกุนหนู)'
  },
  'Dodge': {
    nameTh: 'หลบหลีก (闪)', nameEn: 'Dodge', type: 'basic',
    color: '#2980b9',
    desc: 'ใช้เพื่อป้องกันการโจมตี ยกเลิกความเสียหาย 1 จุดจากไพ่โจมตี',
    usage: 'ใช้เมื่อถูกโจมตี (ตอบสนองอัตโนมัติ)',
    image: '/GameCard/BasicCard/Dodge.png',
    limit: null,
    tips: 'ควรเก็บสำรองไว้เสมอ ไม่ต้องใช้เชิงรุก'
  },
  'Peach': {
    nameTh: 'เพอช์ (桃)', nameEn: 'Peach', type: 'basic',
    color: '#e91e8c',
    desc: 'รักษา HP 1 จุด ใช้ได้เฉพาะในช่วงออกไพ่ หรือเมื่อผู้เล่นคนใดจะตาย',
    usage: 'คลิกเพอช์ → เลือกตัวเอง หรือผู้ที่จะตาย',
    image: '/GameCard/BasicCard/Peach.png',
    limit: null,
    tips: 'ใช้ช่วยผู้เล่นที่กำลังจะตายได้ แม้ไม่ใช่ตาของคุณ'
  },
  'Duel': {
    nameTh: 'ท้าดวล (决斗)', nameEn: 'Duel', type: 'stratagem',
    color: '#8e44ad',
    desc: 'ท้าดวลกับเป้าหมาย ทั้งสองสลับใช้ไพ่โจมตีจนฝ่ายใดไม่มีให้ใช้ฝ่ายนั้นสูญเสีย 1 HP',
    usage: 'เลือกเป้าหมาย → ผลัดกันโต้ด้วยไพ่โจมตี',
    image: '/GameCard/StratagemCard/Non-Conditional/Duel.png',
    limit: null,
    tips: 'อย่าดวลกับหลู่ปู้! เขาต้องการไพ่โจมตีน้อยกว่า'
  },
  'Steal': {
    nameTh: 'ขโมย (顺手牵羊)', nameEn: 'Steal', type: 'stratagem',
    color: '#f39c12',
    desc: 'ขโมยไพ่ 1 ใบจากมือหรืออุปกรณ์ของผู้เล่นที่อยู่ในระยะ 1',
    usage: 'เลือกผู้เล่นในระยะ 1 → เลือกไพ่ที่จะขโมย',
    image: '/GameCard/StratagemCard/Non-Conditional/Steal.png',
    limit: null,
    tips: 'ขโมยอุปกรณ์สำคัญของฝ่ายตรงข้ามเพื่อลดพลัง'
  },
  'Burning Bridges': {
    nameTh: 'ทำลายสะพาน (过河拆桥)', nameEn: 'Burning Bridges', type: 'stratagem',
    color: '#e74c3c',
    desc: 'ทิ้งไพ่ 1 ใบจากมือหรืออุปกรณ์ของผู้เล่นในระยะ 1',
    usage: 'เลือกผู้เล่นในระยะ 1 → เลือกไพ่ที่จะทำลาย',
    image: '/GameCard/StratagemCard/Non-Conditional/Burning Bridges.png',
    limit: null,
    tips: 'ทำลายเกราะ/อาวุธของคู่ต่อสู้ก่อนโจมตี'
  },
  'Borrowed Sword': {
    nameTh: 'ยืมดาบ (借刀杀人)', nameEn: 'Borrowed Sword', type: 'stratagem',
    color: '#16a085',
    desc: 'ให้ผู้เล่นที่มีอาวุธโจมตีเป้าหมายที่ระบุ หากไม่โจมตีให้ทิ้งอาวุธของตน',
    usage: 'เลือกผู้ถืออาวุธ → เลือกเป้าหมายที่ต้องการโจมตี',
    image: '/GameCard/StratagemCard/Non-Conditional/Borrowed Sword.png',
    limit: null,
    tips: 'ใช้แทรกแซงความสัมพันธ์ของฝ่ายตรงข้าม'
  },
  'Raining Arrows': {
    nameTh: 'ฝนลูกธนู (万箭齐发)', nameEn: 'Raining Arrows', type: 'stratagem',
    color: '#d35400',
    desc: 'ผู้เล่นทุกคน (ยกเว้นผู้ใช้) ต้องใช้ไพ่หลบหลีก มิฉะนั้นสูญเสีย 1 HP',
    usage: 'ใช้โดยไม่ต้องเลือกเป้าหมาย',
    image: '/GameCard/StratagemCard/Non-Conditional/Raining Arrows.png',
    limit: null,
    tips: 'ทรงพลังในเกมที่มีผู้เล่นมาก ใช้หลังจากกองไพ่หลบหลีกของคู่ต่อสู้หมดแล้ว'
  },
  'Barbarian Invasion': {
    nameTh: 'บุกทะลวงอนารยชน (南蛮入侵)', nameEn: 'Barbarian Invasion', type: 'stratagem',
    color: '#8e44ad',
    desc: 'ผู้เล่นทุกคน (ยกเว้นผู้ใช้) ต้องใช้ไพ่โจมตี มิฉะนั้นสูญเสีย 1 HP',
    usage: 'ใช้โดยไม่ต้องเลือกเป้าหมาย',
    image: '/GameCard/StratagemCard/Non-Conditional/Barbarian Invasion.png',
    limit: null,
    tips: 'เข้าคู่กับ "หน่วยทหารม้าเหล็ก" ของหม่าเชาได้ดีมาก'
  },
  'Bumper Harvest': {
    nameTh: 'เก็บเกี่ยวอุดมสมบูรณ์ (五谷丰登)', nameEn: 'Bumper Harvest', type: 'stratagem',
    color: '#27ae60',
    desc: 'สังเกตไพ่บนสุดจากกองไพ่เท่ากับจำนวนผู้เล่น ผู้เล่นแต่ละคนเลือกเก็บ 1 ใบ',
    usage: 'ใช้โดยไม่ต้องเลือกเป้าหมาย',
    image: '/GameCard/StratagemCard/Non-Conditional/Bumper Harvest.png',
    limit: null,
    tips: 'ผู้ใช้เลือกก่อน ใช้เมื่อกองไพ่มีไพ่ดีๆ อยู่มาก'
  },
  'Oath of the Peach Garden': {
    nameTh: 'สาบานในสวนลูกพีช (桃园结义)', nameEn: 'Oath of the Peach Garden', type: 'stratagem',
    color: '#e91e8c',
    desc: 'รักษา HP ให้ผู้เล่นทุกคนที่ HP ไม่เต็ม คนละ 1 จุด',
    usage: 'ใช้โดยไม่ต้องเลือกเป้าหมาย',
    image: '/GameCard/StratagemCard/Non-Conditional/Oath of the Peach Garden.png',
    limit: null,
    tips: 'Lord ควรใช้เมื่อ Loyalist หลายคน HP ต่ำ'
  },
  'Negation': {
    nameTh: 'ปฏิเสธ (无懈可击)', nameEn: 'Negation', type: 'stratagem',
    color: '#7f8c8d',
    desc: 'ยกเลิกผลของไพ่กลไพ่หนึ่ง หรือยกเลิกการ Negation ของผู้อื่น',
    usage: 'ใช้ตอบสนองเมื่อเห็นไพ่กลที่ต้องการยกเลิก',
    image: '/GameCard/StratagemCard/Non-Conditional/Negation.png',
    limit: null,
    tips: 'ไพ่ที่ทรงพลังที่สุดในเกม ใช้ป้องกันไพ่ที่ร้ายแรงได้ทุกไพ่'
  },
  'Something Out of Nothing': {
    nameTh: 'สร้างจากความว่างเปล่า (无中生有)', nameEn: 'Something Out of Nothing', type: 'stratagem',
    color: '#3498db',
    desc: 'หยิบไพ่ 2 ใบจากกองไพ่',
    usage: 'ใช้ในช่วงออกไพ่',
    image: '/GameCard/StratagemCard/Non-Conditional/Something Out of Noting.png',
    limit: null,
    tips: 'ไพ่แห่งปริมาณ ใช้เติมมือเมื่อไพ่น้อย'
  },
  'Overindulgence': {
    nameTh: 'เสพสุขเกินพอดี (乐不思蜀)', nameEn: 'Overindulgence', type: 'stratagem',
    color: '#f1c40f',
    desc: 'ติดตามผู้เล่นเป้าหมาย ในช่วงวิเคราะห์ หากออกไพ่แดงข้ามช่วงออกไพ่ทั้งตา',
    usage: 'เลือกเป้าหมาย → ใช้ไพ่ (ผลจะคงอยู่จนกว่าจะผ่านการวิเคราะห์สีแดง)',
    image: '/GameCard/StratagemCard/Conditional/Overindulgence.png',
    limit: null,
    tips: 'ใช้กับ Lord หรือผู้เล่นที่อันตรายมากที่สุด'
  },
  'Lightning': {
    nameTh: 'สายฟ้า (闪电)', nameEn: 'Lightning', type: 'stratagem',
    color: '#f39c12',
    desc: 'ติดตามผู้เล่น ในช่วงวิเคราะห์ หากออกไพ่โพดำ 2-9 ฟ้าผ่า 3 HP สายฟ้าส่งต่อถ้าไม่ผ่า',
    usage: 'ใช้ในช่วงออกไพ่ (ผลจะหมุนเวียนไปในแต่ละตา)',
    image: '/GameCard/StratagemCard/Conditional/Lightning.png',
    limit: null,
    tips: 'ระวัง! อาจฟ้าผ่าตัวเองได้ ใช้เมื่อฝ่ายตรงข้าม HP สูงหรือมีตัวหยุดได้'
  },
  'Zhuge Crossbow': {
    nameTh: 'ไม้ซานกุนหนู (诸葛连弩)', nameEn: 'Zhuge Crossbow', type: 'weapon',
    range: 1, color: '#795548',
    desc: 'ระยะโจมตี 1 — ผู้ถือสามารถโจมตีได้ไม่จำกัดครั้งต่อตา',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Zhuge Crossbow.png',
    tips: 'อาวุธที่ดีสำหรับตัวละครที่มีไพ่โจมตีมาก'
  },
  'Green Dragon Blade': {
    nameTh: 'ง้าวมังกรเขียว (青龙偃月刀)', nameEn: 'Green Dragon Blade', type: 'weapon',
    range: 3, color: '#2ecc71',
    desc: 'ระยะโจมตี 3 — เมื่อโจมตีแล้วเป้าหมายหลบ ผู้ถือสามารถทิ้งไพ่เพื่อโจมตีซ้ำได้',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Green Dragon Blade.png',
    tips: 'อาวุธของกวนอู ทรงพลังมากเมื่อผสมกับทักษะนักรบศักดิ์สิทธิ์'
  },
  'Serpent Spear': {
    nameTh: 'หอกงูดำ (丈八蛇矛)', nameEn: 'Serpent Spear', type: 'weapon',
    range: 3, color: '#1abc9c',
    desc: 'ระยะโจมตี 3 — ผู้ถือสามารถทิ้งไพ่ 2 ใบแทนการใช้ไพ่โจมตีได้',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Serpent Spear.png',
    tips: 'อาวุธของจางเฟย สุดยอดเมื่อมีไพ่มาก'
  },
  'Frost Sword': {
    nameTh: 'ดาบน้ำแข็ง (冰封剑)', nameEn: 'Frost Sword', type: 'weapon',
    range: 2, color: '#74b9ff',
    desc: 'ระยะโจมตี 2 — เมื่อโจมตีสำเร็จ เป้าหมายไม่สามารถใช้ไพ่กลได้ในรอบถัดไป',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Frost Sword.png',
    tips: 'ทรงพลังในการล็อคตัวละครสนับสนุน'
  },
  'Blue Steel Sword': {
    nameTh: 'ดาบฟ้า (青钢剑)', nameEn: 'Blue Steel Sword', type: 'weapon',
    range: 2, color: '#0984e3',
    desc: 'ระยะโจมตี 2 — ผู้ถือสามารถใช้ไพ่ตัดสินแทนไพ่โจมตีได้',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Blue Steel Sword.png',
    tips: 'ใช้ไพ่ที่หลากหลายในการโจมตีได้'
  },
  'Rock Cleaving Axe': {
    nameTh: 'ขวานผ่าหิน (贯石斧)', nameEn: 'Rock Cleaving Axe', type: 'weapon',
    range: 3, color: '#6c5ce7',
    desc: 'ระยะโจมตี 3 — เมื่อโจมตีแล้วเป้าหมายหลบ ผู้ถือสามารถทิ้งไพ่ 2 ใบเพื่อให้ความเสียหายผ่านได้',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Rock Cleaving Axe.png',
    tips: 'ทำลายล้างสูงมาก ต่อสู้กับผู้ที่มีไพ่หลบหลีกมาก'
  },
  'Sky Piercing Halberd': {
    nameTh: 'ง้าวฟ้า (方天画戟)', nameEn: 'Sky Piercing Halberd', type: 'weapon',
    range: 4, color: '#fd79a8',
    desc: 'ระยะโจมตี 4 — อาวุธของหลู่ปู้ เมื่อโจมตีสำเร็จสามารถเล่นไพ่กลเพิ่มอีก 1 ใบฟรี',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Sky Piercing Halberd.png',
    tips: 'ระยะไกลสุดในอาวุธ เหมาะกับหลู่ปู้เป็นพิเศษ'
  },
  'Kirin Bow': {
    nameTh: 'ธนูกิเลน (麒麟弓)', nameEn: 'Kirin Bow', type: 'weapon',
    range: 5, color: '#00b894',
    desc: 'ระยะโจมตี 5 — เมื่อโจมตีสำเร็จ สามารถทิ้งอุปกรณ์ม้าของเป้าหมาย 1 ชิ้น',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Kirin Bow.png',
    tips: 'ระยะไกลที่สุดในเกม ใช้ต่อต้านผู้เล่นที่พึ่งพาม้า'
  },
  'Yin-Yang Swords': {
    nameTh: 'ดาบหยินหยาง (阴阳双股剑)', nameEn: 'Yin-Yang Swords', type: 'weapon',
    range: 2, color: '#b2bec3',
    desc: 'ระยะโจมตี 2 — เมื่อโจมตีสำเร็จ ให้เป้าหมายเลือก: เปิดไพ่ในมือ 1 ใบ หรือทิ้งไพ่ 1 ใบ',
    usage: 'ติดตั้งในช่องอาวุธ',
    image: '/GameCard/Equipment Card/Weapon/Yin-Yang Swords.png',
    tips: 'ให้ข้อมูลเกี่ยวกับไพ่ของคู่ต่อสู้'
  },
  'Eight Trigrams Formation': {
    nameTh: 'กำแพงปากัว (八卦阵)', nameEn: 'Eight Trigrams Formation', type: 'armor',
    color: '#e17055',
    desc: 'เกราะ — เมื่อถูกโจมตี ให้วิเคราะห์ไพ่ หากออกไพ่แดงถือว่าใช้ไพ่หลบหลีก',
    usage: 'ติดตั้งในช่องเกราะ',
    image: '/GameCard/Equipment Card/Armor/Eight Trigrams Formation.png',
    tips: '50% โอกาสหลบโดยไม่ต้องใช้ไพ่ เกราะที่ดีที่สุดในเกม'
  },
  'Nio Shield': {
    nameTh: 'โล่นิโอ (仁王盾)', nameEn: 'Nio Shield', type: 'armor',
    color: '#636e72',
    desc: 'เกราะ — ป้องกันความเสียหายจากไพ่ดำ (โพและกระบอง) โดยอัตโนมัติ',
    usage: 'ติดตั้งในช่องเกราะ',
    image: '/GameCard/Equipment Card/Armor/Nio Shield.png',
    tips: 'ดีมากต่อต้านไพ่ที่ใช้ไพ่ดำบ่อย เช่น กานหนิง'
  },
  'Fergana Steed': {
    nameTh: 'ม้าต้าหวาน (大宛良马)', nameEn: 'Fergana Steed', type: 'mount',
    color: '#a29bfe',
    desc: 'ม้าโจมตี — ระยะโจมตีของผู้ถือเพิ่มขึ้น +1',
    usage: 'ติดตั้งในช่องม้าโจมตี',
    image: '/GameCard/Equipment Card/Mount/Fergana Steed.png',
    tips: 'ขยายระยะโจมตีออกไป เหมาะกับตัวละครที่ต้องการระยะ'
  },
  'Shadowrunner': {
    nameTh: 'ม้าเงา (绝影)', nameEn: 'Shadowrunner', type: 'mount',
    color: '#2d3436',
    desc: 'ม้าป้องกัน — ระยะโจมตีของผู้อื่นต่อผู้ถือเพิ่มขึ้น +1 (ยากขึ้นในการโจมตีผู้ถือ)',
    usage: 'ติดตั้งในช่องม้าป้องกัน',
    image: '/GameCard/Equipment Card/Mount/Shadowrunner.png',
    tips: 'ป้องกันตัวเองจากการถูกโจมตีระยะใกล้'
  },
};

// ─── Role Data with Thai Descriptions ────────────────────────────────────────
window.ROLE_DATA = {
  'Lord': {
    nameTh: 'จักรพรรดิ', nameEn: 'Lord',
    image: '/Roll/จักรพรรดิ.png',
    color: '#f39c12',
    desc: 'ผู้ปกครองสูงสุด HP เพิ่มพิเศษ 1 จุด เลือกตัวละครได้หลายตัวและเลือกทีหลัง',
    goal: 'กำจัดกบฎและสายลับทั้งหมด',
    tips: 'เปิดเผยบทบาทให้คนอื่นเห็น ใช้ประโยชน์จาก Loyalist ในการป้องกัน'
  },
  'Loyalist': {
    nameTh: 'ผู้ภักดี', nameEn: 'Loyalist',
    image: '/Roll/ภักดี.png',
    color: '#3498db',
    desc: 'ฝ่ายสนับสนุนจักรพรรดิ ตัวตนซ่อนอยู่ ต้องพิสูจน์ความจงรักภักดี',
    goal: 'ปกป้องจักรพรรดิและกำจัดกบฎ+สายลับ',
    tips: 'ช่วยรักษา Lord เสมอ แต่ระวังอย่าโจมตี Lord หรือผู้เล่นบนโต๊ะจะสงสัยคุณ'
  },
  'Rebel': {
    nameTh: 'กบฎ', nameEn: 'Rebel',
    image: '/Roll/กบฎ.png',
    color: '#e74c3c',
    desc: 'ฝ่ายโค่นล้มจักรพรรดิ ตัวตนซ่อนอยู่ ต้องระวังไม่ให้ถูกจับได้',
    goal: 'สังหารจักรพรรดิ',
    tips: 'ทำงานร่วมกับกบฎคนอื่น แต่ห้ามเปิดเผยตัวเองก่อนเวลาอันควร'
  },
  'Spy': {
    nameTh: 'สายลับ', nameEn: 'Spy',
    image: '/Roll/ทรยศ.png',
    color: '#9b59b6',
    desc: 'ผู้เล่นคนเดียว ต้องกำจัดทุกฝ่ายและเหลือรอดคนเดียว',
    goal: 'เป็นผู้เล่นคนสุดท้ายที่รอดชีวิต',
    tips: 'ในช่วงต้นช่วยจักรพรรดิ ช่วงปลายหักหลัง ต้องรู้จังหวะในการเปลี่ยนข้าง'
  }
};
