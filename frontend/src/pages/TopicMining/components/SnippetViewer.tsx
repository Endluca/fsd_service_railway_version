import React, { useState } from 'react';
import { Card, Tag, Checkbox } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { SampleSnippet, DialogueMessage } from '../../../types/topicmining';

interface SnippetViewerProps {
  snippet: SampleSnippet;
  snippetIndex: number;
  showSelection?: boolean;
  selected?: boolean;
  onSelectionChange?: (index: number, selected: boolean) => void;
}

const SnippetViewer: React.FC<SnippetViewerProps> = ({
  snippet,
  snippetIndex,
  showSelection = false,
  selected = false,
  onSelectionChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const dialogues = snippet.dialogues || [];

  // 将对话分成两列
  const midpoint = Math.ceil(dialogues.length / 2);
  const leftColumn = dialogues.slice(0, midpoint);
  const rightColumn = dialogues.slice(midpoint);

  const renderDialogue = (dialogue: DialogueMessage, index: number) => {
    const isCustomer = dialogue.role === 'customer';
    return (
      <div
        key={index}
        style={{
          backgroundColor: isCustomer ? '#f5f5f5' : '#e6f7ff',
          padding: '8px 12px',
          borderRadius: '4px',
          marginBottom: '8px',
          border: `1px solid ${isCustomer ? '#d9d9d9' : '#91d5ff'}`,
        }}
      >
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
          <Tag color={isCustomer ? 'default' : 'blue'} style={{ marginRight: 8 }}>
            {isCustomer ? '客户' : '销售'}
          </Tag>
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {dialogue.text}
        </div>
      </div>
    );
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: '16px',
        border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
      }}
      bodyStyle={{ padding: 0 }}
    >
      {/* 折叠/展开头部 - 始终可见 */}
      <div
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: expanded ? '1px solid #f0f0f0' : 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {/* 展开/收起图标 */}
          {expanded ? (
            <DownOutlined style={{ fontSize: '12px', color: '#666' }} />
          ) : (
            <RightOutlined style={{ fontSize: '12px', color: '#666' }} />
          )}

          {/* 话题名称 */}
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            {snippet.topicName || '未命名话题'}
          </span>

          {/* 标签 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {snippet.turnCount !== undefined && (
              <Tag color="green">轮次: {snippet.turnCount}</Tag>
            )}
            {snippet.charCount !== undefined && (
              <Tag color="orange">字符: {snippet.charCount}</Tag>
            )}
          </div>
        </div>

        {/* 选中复选框 */}
        {showSelection && (
          <Checkbox
            checked={selected}
            onChange={(e) => {
              e.stopPropagation(); // 防止触发折叠/展开
              onSelectionChange?.(snippetIndex, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            选中
          </Checkbox>
        )}
      </div>

      {/* 对话内容 - 仅在展开时显示 */}
      {expanded && (
        <div style={{ padding: '16px' }}>
          {dialogues.length > 0 ? (
            <div style={{ display: 'flex', gap: '16px' }}>
              {/* 左列 */}
              <div style={{ flex: 1 }}>
                {leftColumn.map((dialogue, index) => renderDialogue(dialogue, index))}
              </div>

              {/* 右列 */}
              <div style={{ flex: 1 }}>
                {rightColumn.map((dialogue, index) =>
                  renderDialogue(dialogue, index + midpoint)
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
              无对话内容
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default SnippetViewer;
