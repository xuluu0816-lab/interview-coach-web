import { JdAnalyzer } from '@/components/prep/JdAnalyzer';

export default function PrepPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">面试预习</h1>
        <p className="text-gray-500 text-sm mt-1">上传岗位JD，AI生成公司调研框架 + 业务场景面试题，提前备战</p>
      </div>
      <JdAnalyzer />
    </div>
  );
}
