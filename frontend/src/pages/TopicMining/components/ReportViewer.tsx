import React, { useState, useEffect } from 'react';
import { Modal, Spin, message, Descriptions, Divider, Card } from 'antd';
import { getReportById } from '../../../services/topicminingApi';
import type { ReportEntity } from '../../../types/topicmining';
import StatisticsPanel from './StatisticsPanel';
import ChartViewer from './ChartViewer';

interface ReportViewerProps {
  reportId: string | null;
  onClose: () => void;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ reportId, onClose }) => {
  const [report, setReport] = useState<ReportEntity | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setReport(null);
      return;
    }

    const loadReport = async () => {
      setLoading(true);
      try {
        const data = await getReportById(reportId);
        setReport(data);
      } catch (error: any) {
        message.error(error.message || '加载报告失败');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportId, onClose]);

  return (
    <Modal
      title="报告详情"
      open={!!reportId}
      onCancel={onClose}
      footer={null}
      width="100vw"
      style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
      bodyStyle={{
        height: 'calc(100vh - 110px)',
        overflowY: 'auto',
        padding: '24px',
      }}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : report ? (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* 报告基本信息 */}
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="报告标题" span={2}>
              {report.title}
            </Descriptions.Item>
            {report.summary && (
              <Descriptions.Item label="报告摘要" span={2}>
                {report.summary}
              </Descriptions.Item>
            )}
            {report.metadata?.totalSessions !== undefined && (
              <Descriptions.Item label="总会话数">
                {report.metadata.totalSessions}
              </Descriptions.Item>
            )}
            {report.metadata?.timeRange && (
              <Descriptions.Item label="时间范围">
                {report.metadata.timeRange.start} ~ {report.metadata.timeRange.end}
              </Descriptions.Item>
            )}
          </Descriptions>

          <Divider />

          {/* 总体饼图区域 */}
          <Card title="总体类目分布" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ maxWidth: '1200px', width: '100%' }}>
                <ChartViewer statistics={report.statistics} />
              </div>
            </div>
          </Card>

          {/* 详细统计表格区域（含展开的二级饼图和选中的片段） */}
          <StatisticsPanel statistics={report.statistics} savedSnippets={report.samples} />
        </div>
      ) : null}
    </Modal>
  );
};

export default ReportViewer;
