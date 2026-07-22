import app from './app';
import { config } from './config';
import { initDb, db, saveDb, questionBank } from './db';
import { warmUpOcr } from './services/file/parser';

/** 自动填充题库种子数据 */
function autoSeed() {
  const count = db().select().from(questionBank).all().length;
  if (count > 0) {
    console.log(`Question bank already has ${count} questions, skipping seed.`);
    return;
  }

  console.log('Question bank is empty, seeding 60 questions...');

  const questions = [
    // BQ-领导力
    { id: 'q_001', category: 'BQ', sub_category: 'leadership', difficulty: 'intermediate', question_text: '请分享一个你带领团队达成目标的经历', tips: null },
    { id: 'q_002', category: 'BQ', sub_category: 'leadership', difficulty: 'intermediate', question_text: '描述一次你影响他人接受你观点的经历', tips: null },
    { id: 'q_003', category: 'BQ', sub_category: 'leadership', difficulty: 'intermediate', question_text: '你是如何激励一个士气低落的团队成员的？', tips: null },
    { id: 'q_004', category: 'BQ', sub_category: 'leadership', difficulty: 'advanced', question_text: '你有没有在资源不足的情况下完成目标的经历？', tips: null },
    { id: 'q_005', category: 'BQ', sub_category: 'leadership', difficulty: 'advanced', question_text: '讲一个你在没有正式职权的情况下领导项目的例子', tips: null },
    // BQ-冲突处理
    { id: 'q_006', category: 'BQ', sub_category: 'conflict', difficulty: 'intermediate', question_text: '和同事/上级意见严重分歧时，你是怎么处理的？', tips: null },
    { id: 'q_007', category: 'BQ', sub_category: 'conflict', difficulty: 'intermediate', question_text: '描述一次你面对难缠的客户/用户的经历', tips: null },
    { id: 'q_008', category: 'BQ', sub_category: 'conflict', difficulty: 'intermediate', question_text: '团队中有人不配合你的工作，你怎么办？', tips: null },
    { id: 'q_009', category: 'BQ', sub_category: 'conflict', difficulty: 'intermediate', question_text: '你有没有在工作中被误解的经历？怎么澄清的？', tips: null },
    { id: 'q_010', category: 'BQ', sub_category: 'conflict', difficulty: 'advanced', question_text: '如果你不同意上级的决策，会怎么做？', tips: null },
    // BQ-失败
    { id: 'q_011', category: 'BQ', sub_category: 'failure', difficulty: 'intermediate', question_text: '说说你最大的一次失败，以及你从中学到了什么', tips: null },
    { id: 'q_012', category: 'BQ', sub_category: 'failure', difficulty: 'intermediate', question_text: '描述一个你没能按时完成的任务', tips: null },
    { id: 'q_013', category: 'BQ', sub_category: 'failure', difficulty: 'intermediate', question_text: '你有没有在工作中犯过错误？怎么弥补的？', tips: null },
    { id: 'q_014', category: 'BQ', sub_category: 'failure', difficulty: 'advanced', question_text: '如果你能重新做一次过去的选择，会改变什么？', tips: null },
    { id: 'q_015', category: 'BQ', sub_category: 'failure', difficulty: 'beginner', question_text: '你如何面对批评和负面反馈？', tips: null },
    // BQ-团队合作
    { id: 'q_016', category: 'BQ', sub_category: 'teamwork', difficulty: 'beginner', question_text: '描述你在团队中扮演的角色', tips: null },
    { id: 'q_017', category: 'BQ', sub_category: 'teamwork', difficulty: 'intermediate', question_text: '跨部门协作中遇到的最大挑战是什么？', tips: null },
    { id: 'q_018', category: 'BQ', sub_category: 'teamwork', difficulty: 'intermediate', question_text: '如果团队中有搭便车者，你怎么办？', tips: null },
    { id: 'q_019', category: 'BQ', sub_category: 'teamwork', difficulty: 'beginner', question_text: '你如何帮助新同事快速融入团队？', tips: null },
    { id: 'q_020', category: 'BQ', sub_category: 'teamwork', difficulty: 'intermediate', question_text: '远程协作中你如何保持沟通效率？', tips: null },
    // BQ-创新
    { id: 'q_021', category: 'BQ', sub_category: 'creativity', difficulty: 'intermediate', question_text: '你有没有用创造性的方式解决过一个问题？', tips: null },
    { id: 'q_022', category: 'BQ', sub_category: 'creativity', difficulty: 'intermediate', question_text: '你如何优化过一个低效的流程？', tips: null },
    { id: 'q_023', category: 'BQ', sub_category: 'creativity', difficulty: 'intermediate', question_text: '面对完全陌生的领域，你如何快速上手？', tips: null },
    { id: 'q_024', category: 'BQ', sub_category: 'creativity', difficulty: 'advanced', question_text: '你有没有主动发起一个项目/改变的体验？', tips: null },
    { id: 'q_025', category: 'BQ', sub_category: 'creativity', difficulty: 'advanced', question_text: '你是如何做出一个重要决策的？', tips: null },
    // BQ-压力
    { id: 'q_026', category: 'BQ', sub_category: 'pressure', difficulty: 'intermediate', question_text: '面对多个截止日期，你如何排优先级？', tips: null },
    { id: 'q_027', category: 'BQ', sub_category: 'pressure', difficulty: 'intermediate', question_text: '描述一个高压环境下你保持冷静的经历', tips: null },
    { id: 'q_028', category: 'BQ', sub_category: 'pressure', difficulty: 'beginner', question_text: '你如何平衡工作/学习和生活？', tips: null },
    { id: 'q_029', category: 'BQ', sub_category: 'pressure', difficulty: 'intermediate', question_text: '如果项目突然被叫停，你什么反应？', tips: null },
    { id: 'q_030', category: 'BQ', sub_category: 'pressure', difficulty: 'intermediate', question_text: '加班到很晚但工作还是做不完，怎么办？', tips: null },
    // CASE-市场
    { id: 'q_031', category: 'CASE', sub_category: 'market', difficulty: 'advanced', question_text: '估算一下中国一年的快递包裹数量', tips: null },
    { id: 'q_032', category: 'CASE', sub_category: 'market', difficulty: 'intermediate', question_text: '为什么星巴克很少打广告？', tips: null },
    { id: 'q_033', category: 'CASE', sub_category: 'market', difficulty: 'intermediate', question_text: '如果让你给微信加一个功能，会是什么？', tips: null },
    { id: 'q_034', category: 'CASE', sub_category: 'market', difficulty: 'advanced', question_text: '为什么共享单车大多不盈利却还在运营？', tips: null },
    { id: 'q_035', category: 'CASE', sub_category: 'market', difficulty: 'advanced', question_text: '分析一下拼多多的竞争优势', tips: null },
    // CASE-产品
    { id: 'q_036', category: 'CASE', sub_category: 'product', difficulty: 'intermediate', question_text: '如何设计一个停车 App？', tips: null },
    { id: 'q_037', category: 'CASE', sub_category: 'product', difficulty: 'advanced', question_text: '抖音和快手的产品差异是什么？', tips: null },
    { id: 'q_038', category: 'CASE', sub_category: 'product', difficulty: 'intermediate', question_text: '如果你负责优化外卖配送时间，会怎么做？', tips: null },
    { id: 'q_039', category: 'CASE', sub_category: 'product', difficulty: 'intermediate', question_text: '如何衡量一个搜索功能的好坏？', tips: null },
    { id: 'q_040', category: 'CASE', sub_category: 'product', difficulty: 'advanced', question_text: '小红书为什么会成功？', tips: null },
    // CASE-策略
    { id: 'q_041', category: 'CASE', sub_category: 'strategy', difficulty: 'advanced', question_text: '苹果为什么不做低端手机？', tips: null },
    { id: 'q_042', category: 'CASE', sub_category: 'strategy', difficulty: 'advanced', question_text: 'B站要不要做短视频？', tips: null },
    { id: 'q_043', category: 'CASE', sub_category: 'strategy', difficulty: 'advanced', question_text: '一个传统零售企业如何数字化转型？', tips: null },
    { id: 'q_044', category: 'CASE', sub_category: 'strategy', difficulty: 'advanced', question_text: '为什么大公司做不出颠覆性创新？', tips: null },
    { id: 'q_045', category: 'CASE', sub_category: 'strategy', difficulty: 'advanced', question_text: '如何评估是否要进入一个新市场？', tips: null },
    // GEN-自我介绍
    { id: 'q_046', category: 'GEN', sub_category: 'self_intro', difficulty: 'beginner', question_text: '请做一下自我介绍（1-2分钟版本）', tips: '姓名+学校/专业亮点+1-2段核心经历+求职意向，控制在90秒以内' },
    { id: 'q_047', category: 'GEN', sub_category: 'self_intro', difficulty: 'beginner', question_text: '请做一下自我介绍（3-5分钟版本）', tips: '详细版：教育背景→核心实习经历→项目经历→技能亮点→为什么适合这个岗位' },
    // GEN-职业动机
    { id: 'q_048', category: 'GEN', sub_category: 'career_motivation', difficulty: 'beginner', question_text: '你为什么想来我们公司？', tips: '展现对公司的了解：产品/文化/成长机会三个维度' },
    { id: 'q_049', category: 'GEN', sub_category: 'career_motivation', difficulty: 'beginner', question_text: '你为什么选择这个行业？', tips: '行业前景+个人兴趣+能力匹配' },
    { id: 'q_050', category: 'GEN', sub_category: 'career_motivation', difficulty: 'intermediate', question_text: '你的职业规划是什么？（3年/5年）', tips: '分阶段描述：短期学什么→中期成什么→长期贡献什么' },
    { id: 'q_051', category: 'GEN', sub_category: 'career_motivation', difficulty: 'intermediate', question_text: '你为什么离开上一家公司？', tips: '正向表述：寻求更大挑战/成长空间，不要抱怨前公司' },
    { id: 'q_052', category: 'GEN', sub_category: 'career_motivation', difficulty: 'intermediate', question_text: '我们为什么要录用你？', tips: '核心公式：我能做什么（能力）+我做过什么（经历）+我有什么不同（亮点）' },
    // GEN-个人特质
    { id: 'q_053', category: 'GEN', sub_category: 'personal_traits', difficulty: 'beginner', question_text: '你最大的优点是什么？', tips: '选1-2个与岗位最相关的优点，配具体例子' },
    { id: 'q_054', category: 'GEN', sub_category: 'personal_traits', difficulty: 'beginner', question_text: '你最大的缺点是什么？', tips: '选真实的非致命缺点+你已经采取的改善措施' },
    { id: 'q_055', category: 'GEN', sub_category: 'personal_traits', difficulty: 'beginner', question_text: '你的朋友/同事怎么评价你？', tips: '引用他人评价体现客观性，选2-3个正面特质' },
    { id: 'q_056', category: 'GEN', sub_category: 'personal_traits', difficulty: 'beginner', question_text: '工作以外你有什么兴趣爱好？', tips: '展示多元化+与岗位的隐性关联' },
    { id: 'q_057', category: 'GEN', sub_category: 'personal_traits', difficulty: 'beginner', question_text: '对你影响最大的人是谁？', tips: '选一个能体现你价值观的人，讲清楚影响你的具体方式' },
    // GEN-情景题
    { id: 'q_058', category: 'GEN', sub_category: 'situational', difficulty: 'intermediate', question_text: '如果你被分配了一个完全不会的任务，怎么办？', tips: '展示学习能力：拆解任务→寻找资源→制定计划→及时反馈' },
    { id: 'q_059', category: 'GEN', sub_category: 'situational', difficulty: 'intermediate', question_text: '客户提出了不合理的要求，你怎么回应？', tips: '先理解诉求→说明客观限制→提出替代方案' },
    { id: 'q_060', category: 'GEN', sub_category: 'situational', difficulty: 'intermediate', question_text: '入职后发现实际工作和面试说的不一样，怎么办？', tips: '主动沟通确认期望→寻找价值点→设定适应期→理性决策' },
  ];

  for (const q of questions) {
    db().insert(questionBank).values(q).run();
  }
  saveDb();
  console.log(`Seeded ${questions.length} questions into question bank.`);
}

async function start() {
  console.log('Initializing database...');
  await initDb();
  console.log('Database initialized.');

  // 自动填充题库
  autoSeed();

  // 预热 OCR 引擎（后台下载 tesseract.js 语言包，避免首次图片上传超时）
  warmUpOcr();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
