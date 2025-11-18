import React, { useState } from 'react';
import { Typography, Tabs, Divider } from 'antd';
import CsvUploader from './components/CsvUploader';
import ParseResultPreview from './components/ParseResultPreview';
import StatisticsPanel from './components/StatisticsPanel';
import ChartViewer from './components/ChartViewer';
import ReportGenerator from './components/ReportGenerator';
import ReportHistory from './components/ReportHistory';
import ReportViewer from './components/ReportViewer';
import type { CsvParseResult } from '../../types/topicmining';
import { useTopicMiningStore } from '../../stores/useTopicMiningStore';

const { Title } = Typography;

const TopicMining: React.FC = () => {
  // 从store获取状态和actions
  const {
    parseResult,
    fileName,
    activeTab,
    setParseResult,
    setFileName,
    setActiveTab,
  } = useTopicMiningStore();

  // 本地状态（不需要持久化的状态）
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

  const handleParseSuccess = (result: CsvParseResult, file: File) => {
    setParseResult(result);
    setFileName(file.name);
  };

  const handleReportCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleViewReport = (reportId: string) => {
    setViewingReportId(reportId);
  };

  const handleCloseViewer = () => {
    setViewingReportId(null);
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
      <Title level={2}>话题挖掘</Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'upload',
            label: '上传与分析',
            children: (
              <div>
                {/* CSV 上传区域 */}
                <CsvUploader onParseSuccess={handleParseSuccess} />

                {parseResult && (
                  <>
                    <Divider />

                    {/* 解析结果预览 */}
                    <ParseResultPreview result={parseResult} fileName={fileName} />

                    <Divider />

                    {/* 饼图部分 - 全宽展示 */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ maxWidth: '1200px', width: '100%' }}>
                        <ChartViewer statistics={parseResult.statistics} />
                      </div>
                    </div>

                    <Divider style={{ margin: '24px 0' }} />

                    {/* 统计表格 - 全宽展示 */}
                    <StatisticsPanel statistics={parseResult.statistics} />

                    <Divider style={{ margin: '24px 0' }} />

                    {/* 报告生成表单 */}
                    <ReportGenerator
                      statistics={parseResult.statistics}
                      fileName={fileName}
                      onReportCreated={handleReportCreated}
                    />
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'history',
            label: '报告历史',
            children: (
              <ReportHistory
                refreshTrigger={refreshTrigger}
                onViewReport={handleViewReport}
              />
            ),
          },
        ]}
      />

      {/* 报告查看器 */}
      <ReportViewer reportId={viewingReportId} onClose={handleCloseViewer} />
    </div>
  );
};

export default TopicMining;
