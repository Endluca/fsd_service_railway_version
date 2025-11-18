import React, { useState } from 'react';
import { Table, Card, Tag, Divider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CsvAnalysisResult, ParentStat, ChildStat, SampleSelectionResult } from '../../../types/topicmining';
import ChildChartViewer from './ChildChartViewer';
import SnippetViewer from './SnippetViewer';

interface StatisticsPanelProps {
  statistics: CsvAnalysisResult;
  savedSnippets?: SampleSelectionResult; // 用于报告查看模式，只显示保存的片段
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ statistics, savedSnippets }) => {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [childExpandedKeys, setChildExpandedKeys] = useState<Record<string, string[]>>({});

  // 一级类目表格列
  const parentColumns: ColumnsType<ParentStat> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      align: 'center',
      render: (rank: number) => (
        <Tag color={rank <= 3 ? 'gold' : 'default'}>#{rank}</Tag>
      ),
    },
    {
      title: '一级类目',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.count - b.count,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 120,
      align: 'right',
      render: (percentage: number) => `${percentage.toFixed(2)}%`,
    },
  ];

  // 二级类目表格列
  const childColumns: ColumnsType<ChildStat> = [
    {
      title: '二级类目',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 120,
      align: 'right',
    },
    {
      title: '父类占比',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 120,
      align: 'right',
      render: (percentage: number) => `${percentage.toFixed(2)}%`,
    },
    {
      title: '总体占比',
      dataIndex: 'parentPercentage',
      key: 'parentPercentage',
      width: 120,
      align: 'right',
      render: (percentage: number) => `${percentage.toFixed(2)}%`,
    },
  ];

  return (
    <Card title={`类目统计 (共 ${statistics.totalCount} 条记录)`} size="small">
      <Table
        columns={parentColumns}
        dataSource={statistics.parents}
        rowKey="name"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        expandable={{
          childrenColumnName: 'no_children',
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
          expandedRowRender: (record) => (
            <div style={{ marginLeft: 40 }}>
              {/* 二级饼图 */}
              <ChildChartViewer data={record.children || []} parentName={record.name} />

              {/* 分隔线 */}
              <Divider style={{ margin: '16px 0' }} />

              {/* 二级表格 */}
              <Table
                columns={childColumns}
                dataSource={record.children || []}
                rowKey="name"
                pagination={false}
                size="small"
                expandable={{
                  expandedRowKeys: childExpandedKeys[record.name] || [],
                  onExpandedRowsChange: (keys) => {
                    setChildExpandedKeys((prev) => ({
                      ...prev,
                      [record.name]: keys as string[],
                    }));
                  },
                  expandedRowRender: (childRecord) => {
                    // 获取该child category的snippets
                    // 如果传入了savedSnippets（报告查看模式），则只显示保存的片段
                    // 否则显示所有片段（预览模式）
                    const snippets = savedSnippets?.childSamples?.[record.name]?.[childRecord.name] ||
                      statistics.childSamples?.[record.name]?.[childRecord.name] || [];

                    if (snippets.length === 0) {
                      return (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                          暂无上下文片段
                        </div>
                      );
                    }

                    return (
                      <div style={{ padding: '0 20px' }}>
                        <div
                          style={{
                            marginBottom: '12px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                          }}
                        >
                          上下文片段 ({snippets.length})
                        </div>
                        {snippets.map((snippet, index) => (
                          <SnippetViewer
                            key={index}
                            snippet={snippet}
                            snippetIndex={index}
                            showSelection={false}
                          />
                        ))}
                      </div>
                    );
                  },
                }}
              />
            </div>
          ),
        }}
        size="small"
      />
    </Card>
  );
};

export default StatisticsPanel;
