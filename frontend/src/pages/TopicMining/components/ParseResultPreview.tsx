import React from 'react';
import { Alert, Descriptions, Card, Tag } from 'antd';
import type { CsvParseResult } from '../../../types/topicmining';

interface ParseResultPreviewProps {
  result: CsvParseResult;
  fileName?: string;
}

const ParseResultPreview: React.FC<ParseResultPreviewProps> = ({ result, fileName }) => {
  const { warnings, metadata, statistics } = result;

  return (
    <div>
      {/* 警告信息 */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {warnings.map((warning, index) => (
            <Alert
              key={index}
              message={warning.message}
              type="warning"
              showIcon
              closable
              style={{ marginBottom: 8 }}
            />
          ))}
        </div>
      )}

      {/* 解析元数据 */}
      <Card title="解析结果" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          {fileName && (
            <Descriptions.Item label="文件名">{fileName}</Descriptions.Item>
          )}
          <Descriptions.Item label="原始行数">
            {metadata.originalRowCount}
          </Descriptions.Item>
          <Descriptions.Item label="有效数据">
            {metadata.validRowCount}
          </Descriptions.Item>
          <Descriptions.Item label="移除重复">
            {metadata.removedDuplicates} 条
          </Descriptions.Item>
          <Descriptions.Item label="移除空行">
            {metadata.removedEmptyRows} 条
          </Descriptions.Item>
          <Descriptions.Item label="解析耗时">
            {metadata.executionTimeMs.toFixed(2)} ms
          </Descriptions.Item>
          <Descriptions.Item label="总统计数">
            {statistics.totalCount}
          </Descriptions.Item>
          <Descriptions.Item label="一级类目数">
            {statistics.parents.length}
          </Descriptions.Item>
          {statistics.skippedEmptyParent > 0 && (
            <Descriptions.Item label="跳过空类目">
              <Tag color="orange">{statistics.skippedEmptyParent} 条</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </div>
  );
};

export default ParseResultPreview;
