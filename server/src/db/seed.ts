/**
 * 种子数据：60 道面试题
 * 运行：npx tsx src/db/seed.ts
 */
import { sql } from 'drizzle-orm';
import { initDb, db, questionBank, saveDb } from './index';

const BQ = 'BQ' as const;
const CASE = 'CASE' as const;
const GEN = 'GEN' as const;
const BEG = 'beginner' as const;
const INT = 'intermediate' as const;
const ADV = 'advanced' as const;

const questions = [
  // BQ-领导力
  { category: BQ, sub_category: 'leadership', difficulty: INT, question_text: '请分享一个你带领团队达成目标的经历' },
  { category: BQ, sub_category: 'leadership', difficulty: INT, question_text: '描述一次你影响他人接受你观点的经历' },
  { category: BQ, sub_category: 'leadership', difficulty: INT, question_text: '你是如何激励一个士气低落的团队成员的？' },
  { category: BQ, sub_category: 'leadership', difficulty: ADV, question_text: '你有没有在资源不足的情况下完成目标的经历？' },
  { category: BQ, sub_category: 'leadership', difficulty: ADV, question_text: '讲一个你在没有正式职权的情况下领导项目的例子' },
  // BQ-冲突处理
  { category: BQ, sub_category: 'conflict', difficulty: INT, question_text: '和同事/上级意见严重分歧时，你是怎么处理的？' },
  { category: BQ, sub_category: 'conflict', difficulty: INT, question_text: '描述一次你面对难缠的客户/用户的经历' },
  { category: BQ, sub_category: 'conflict', difficulty: INT, question_text: '团队中有人不配合你的工作，你怎么办？' },
  { category: BQ, sub_category: 'conflict', difficulty: INT, question_text: '你有没有在工作中被误解的经历？怎么澄清的？' },
  { category: BQ, sub_category: 'conflict', difficulty: ADV, question_text: '如果你不同意上级的决策，会怎么做？' },
  // BQ-失败与挫折
  { category: BQ, sub_category: 'failure', difficulty: INT, question_text: '说说你最大的一次失败，以及你从中学到了什么' },
  { category: BQ, sub_category: 'failure', difficulty: INT, question_text: '描述一个你没能按时完成的任务' },
  { category: BQ, sub_category: 'failure', difficulty: INT, question_text: '你有没有在工作中犯过错误？怎么弥补的？' },
  { category: BQ, sub_category: 'failure', difficulty: ADV, question_text: '如果你能重新做一次过去的选择，会改变什么？' },
  { category: BQ, sub_category: 'failure', difficulty: BEG, question_text: '你如何面对批评和负面反馈？' },
  // BQ-团队合作
  { category: BQ, sub_category: 'teamwork', difficulty: BEG, question_text: '描述你在团队中扮演的角色' },
  { category: BQ, sub_category: 'teamwork', difficulty: INT, question_text: '跨部门协作中遇到的最大挑战是什么？' },
  { category: BQ, sub_category: 'teamwork', difficulty: INT, question_text: '如果团队中有搭便车者，你怎么办？' },
  { category: BQ, sub_category: 'teamwork', difficulty: BEG, question_text: '你如何帮助新同事快速融入团队？' },
  { category: BQ, sub_category: 'teamwork', difficulty: INT, question_text: '远程协作中你如何保持沟通效率？' },
  // BQ-创新与问题解决
  { category: BQ, sub_category: 'creativity', difficulty: INT, question_text: '你有没有用创造性的方式解决过一个问题？' },
  { category: BQ, sub_category: 'creativity', difficulty: INT, question_text: '你如何优化过一个低效的流程？' },
  { category: BQ, sub_category: 'creativity', difficulty: INT, question_text: '面对完全陌生的领域，你如何快速上手？' },
  { category: BQ, sub_category: 'creativity', difficulty: ADV, question_text: '你有没有主动发起一个项目/改变的体验？' },
  { category: BQ, sub_category: 'creativity', difficulty: ADV, question_text: '你是如何做出一个重要决策的？' },
  // BQ-压力与时间管理
  { category: BQ, sub_category: 'pressure', difficulty: INT, question_text: '面对多个截止日期，你如何排优先级？' },
  { category: BQ, sub_category: 'pressure', difficulty: INT, question_text: '描述一个高压环境下你保持冷静的经历' },
  { category: BQ, sub_category: 'pressure', difficulty: BEG, question_text: '你如何平衡工作/学习和生活？' },
  { category: BQ, sub_category: 'pressure', difficulty: INT, question_text: '如果项目突然被叫停，你什么反应？' },
  { category: BQ, sub_category: 'pressure', difficulty: INT, question_text: '加班到很晚但工作还是做不完，怎么办？' },
  // CASE-市场
  { category: CASE, sub_category: 'market', difficulty: ADV, question_text: '估算一下中国一年的快递包裹数量' },
  { category: CASE, sub_category: 'market', difficulty: INT, question_text: '为什么星巴克很少打广告？' },
  { category: CASE, sub_category: 'market', difficulty: INT, question_text: '如果让你给微信加一个功能，会是什么？' },
  { category: CASE, sub_category: 'market', difficulty: ADV, question_text: '为什么共享单车大多不盈利却还在运营？' },
  { category: CASE, sub_category: 'market', difficulty: ADV, question_text: '分析一下拼多多的竞争优势' },
  // CASE-产品
  { category: CASE, sub_category: 'product', difficulty: INT, question_text: '如何设计一个停车 App？' },
  { category: CASE, sub_category: 'product', difficulty: ADV, question_text: '抖音和快手的产品差异是什么？' },
  { category: CASE, sub_category: 'product', difficulty: INT, question_text: '如果你负责优化外卖配送时间，会怎么做？' },
  { category: CASE, sub_category: 'product', difficulty: INT, question_text: '如何衡量一个搜索功能的好坏？' },
  { category: CASE, sub_category: 'product', difficulty: ADV, question_text: '小红书为什么会成功？' },
  // CASE-策略
  { category: CASE, sub_category: 'strategy', difficulty: ADV, question_text: '苹果为什么不做低端手机？' },
  { category: CASE, sub_category: 'strategy', difficulty: ADV, question_text: 'B站要不要做短视频？' },
  { category: CASE, sub_category: 'strategy', difficulty: ADV, question_text: '一个传统零售企业如何数字化转型？' },
  { category: CASE, sub_category: 'strategy', difficulty: ADV, question_text: '为什么大公司做不出颠覆性创新？' },
  { category: CASE, sub_category: 'strategy', difficulty: ADV, question_text: '如何评估是否要进入一个新市场？' },
  // GEN-自我介绍
  { category: GEN, sub_category: 'self_intro', difficulty: BEG, question_text: '请做一下自我介绍（1-2分钟版本）', tips: '姓名+学校/专业亮点+1-2段核心经历+求职意向，控制在90秒以内' },
  { category: GEN, sub_category: 'self_intro', difficulty: BEG, question_text: '请做一下自我介绍（3-5分钟版本）', tips: '详细版：教育背景→核心实习经历→项目经历→技能亮点→为什么适合这个岗位' },
  // GEN-职业动机
  { category: GEN, sub_category: 'career_motivation', difficulty: BEG, question_text: '你为什么想来我们公司？', tips: '展现对公司的了解：产品/文化/成长机会三个维度' },
  { category: GEN, sub_category: 'career_motivation', difficulty: BEG, question_text: '你为什么选择这个行业？', tips: '行业前景+个人兴趣+能力匹配' },
  { category: GEN, sub_category: 'career_motivation', difficulty: INT, question_text: '你的职业规划是什么？（3年/5年）', tips: '分阶段描述：短期学什么→中期成什么→长期贡献什么' },
  { category: GEN, sub_category: 'career_motivation', difficulty: INT, question_text: '你为什么离开上一家公司？', tips: '正向表述：寻求更大挑战/成长空间，不要抱怨前公司' },
  { category: GEN, sub_category: 'career_motivation', difficulty: INT, question_text: '我们为什么要录用你？', tips: '核心公式：我能做什么（能力）+我做过什么（经历）+我有什么不同（亮点）' },
  // GEN-个人特质
  { category: GEN, sub_category: 'personal_traits', difficulty: BEG, question_text: '你最大的优点是什么？', tips: '选1-2个与岗位最相关的优点，配具体例子' },
  { category: GEN, sub_category: 'personal_traits', difficulty: BEG, question_text: '你最大的缺点是什么？', tips: '选真实的非致命缺点+你已经采取的改善措施' },
  { category: GEN, sub_category: 'personal_traits', difficulty: BEG, question_text: '你的朋友/同事怎么评价你？', tips: '引用他人评价体现客观性，选2-3个正面特质' },
  { category: GEN, sub_category: 'personal_traits', difficulty: BEG, question_text: '工作以外你有什么兴趣爱好？', tips: '展示多元化+与岗位的隐性关联' },
  { category: GEN, sub_category: 'personal_traits', difficulty: BEG, question_text: '对你影响最大的人是谁？', tips: '选一个能体现你价值观的人，讲清楚影响你的具体方式' },
  // GEN-情景题
  { category: GEN, sub_category: 'situational', difficulty: INT, question_text: '如果你被分配了一个完全不会的任务，怎么办？', tips: '展示学习能力：拆解任务→寻找资源→制定计划→及时反馈' },
  { category: GEN, sub_category: 'situational', difficulty: INT, question_text: '客户提出了不合理的要求，你怎么回应？', tips: '先理解诉求→说明客观限制→提出替代方案' },
  { category: GEN, sub_category: 'situational', difficulty: INT, question_text: '入职后发现实际工作和面试说的不一样，怎么办？', tips: '主动沟通确认期望→寻找价值点→设定适应期→理性决策' },
];

async function seed() {
  console.log('Initializing database...');
  await initDb();
  console.log('Seeding question bank...');

  // 清空并插入
  db().delete(questionBank).run();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    db().insert(questionBank).values({ id: `q_${String(i + 1).padStart(3, '0')}`, ...q, tips: (q as any).tips || null }).run();
  }
  saveDb();

  console.log(`Seeded ${questions.length} questions successfully.`);
  const stats = db().select({ category: questionBank.category, count: sql`COUNT(*)` }).from(questionBank).groupBy(questionBank.category).all();
  console.log('\nQuestion counts by category:');
  stats.forEach((row: any) => console.log(`  ${row.category}: ${row.count}`));
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
