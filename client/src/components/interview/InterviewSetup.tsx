import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createSession } from '@/lib/api';
import { categoryLabel, levelLabel, cn } from '@/lib/utils';
import type { InterviewConfig, Session, ExperienceLevel, QuestionCategory } from '@/types';
import { Upload, ArrowRight } from 'lucide-react';

interface Props {
  onStart: (session: Session, config: InterviewConfig) => void;
}

const levels: ExperienceLevel[] = ['entry', '1-3y', '3-5y', '5y+'];
const categories: QuestionCategory[] = ['BQ', 'CASE', 'GEN'];

const defaultCompanies = ['腾讯', '字节跳动', '阿里巴巴', '百度', '美团', '小红书', '快手', '拼多多'];

export function InterviewSetup({ onStart }: Props) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('AI产品经理');
  const [level, setLevel] = useState<ExperienceLevel>('entry');
  const [selectedTypes, setSelectedTypes] = useState<QuestionCategory[]>(['BQ']);
  const [loading, setLoading] = useState(false);

  const toggleType = (cat: QuestionCategory) => {
    setSelectedTypes(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const session = await createSession({
        company: company || '未指定',
        role,
        level,
      });
      onStart(session, { company, role, level, questionTypes: selectedTypes });
    } catch (err: any) {
      alert('创建面试失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">开始模拟面试</h1>
        <p className="text-gray-500 mt-1">配置面试参数，AI 面试官将为你出题</p>
      </div>

      {/* 目标公司 & 岗位 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">目标信息</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">目标公司</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {defaultCompanies.map(c => (
                <Badge
                  key={c}
                  variant={company === c ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setCompany(c === company ? '' : c)}
                >
                  {c}
                </Badge>
              ))}
            </div>
            <Input
              placeholder="或输入其他公司名称"
              value={company}
              onChange={e => setCompany(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">目标岗位</label>
            <Input
              placeholder="如：产品经理、AI产品、策略产品..."
              value={role}
              onChange={e => setRole(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">经验水平</label>
            <div className="flex gap-2">
              {levels.map(l => (
                <Button
                  key={l}
                  variant={level === l ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLevel(l)}
                >
                  {levelLabel(l)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 题型选择 */}
      <Card>
        <CardHeader><CardTitle className="text-lg">面试题型</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {categories.map(cat => (
              <div
                key={cat}
                onClick={() => toggleType(cat)}
                className={cn(
                  'flex-1 p-4 rounded-lg border-2 cursor-pointer text-center transition-all',
                  selectedTypes.includes(cat)
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="text-sm font-medium">{categoryLabel(cat)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {cat === 'BQ' ? 'STAR法则' : cat === 'CASE' ? '商业分析' : '自我介绍等'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 上传简历（可选的快速通道） */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">上传简历，让AI基于你的真实经历出题</p>
              <p className="text-xs text-gray-400 mt-0.5">支持 PDF、Word、TXT 格式</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/files'}>
              去上传
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 开始按钮 */}
      <Button
        className="w-full h-12 text-base"
        disabled={selectedTypes.length === 0 || loading}
        onClick={handleStart}
      >
        {loading ? '创建中...' : '开始面试'}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
