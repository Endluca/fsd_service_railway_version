import React from 'react';
import { Card, Checkbox, Row, Col, InputNumber, Button, Space } from 'antd';
import type { MonthInfo } from '../../../../types/topicmining';

interface FilterPanelProps {
  availableMonths: MonthInfo[];
  selectedMonths: string[];
  onMonthsChange: (months: string[]) => void;
  parentTopN: number;
  onParentTopNChange: (n: number) => void;
  childTopN: number;
  onChildTopNChange: (n: number) => void;
  onQuery: () => void;
  loading: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  availableMonths,
  selectedMonths,
  onMonthsChange,
  parentTopN,
  onParentTopNChange,
  childTopN,
  onChildTopNChange,
  onQuery,
  loading,
}) => {
  return (
    <Card title="筛选条件">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 月份多选 */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>选择月份：</div>
          {availableMonths.length > 0 ? (
            <Checkbox.Group
              value={selectedMonths}
              onChange={(checkedValues) => onMonthsChange(checkedValues as string[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 16]}>
                {availableMonths.map((m) => (
                  <Col span={4} key={m.month}>
                    <Checkbox value={m.month}>
                      {formatMonthDisplay(m.month)} ({m.reportCount}份报告)
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          ) : (
            <div style={{ color: '#999' }}>暂无可用月份数据</div>
          )}
        </div>

        {/* TopN设置 */}
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>父类展示数量：</div>
            <InputNumber
              min={1}
              max={20}
              value={parentTopN}
              onChange={(value) => onParentTopNChange(value || 1)}
              style={{ width: '100%' }}
              placeholder="每月取前N个父类"
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>子类展示数量：</div>
            <InputNumber
              min={1}
              max={50}
              value={childTopN}
              onChange={(value) => onChildTopNChange(value || 1)}
              style={{ width: '100%' }}
              placeholder="每月取前N个子类"
            />
          </Col>
        </Row>

        {/* 查询按钮 */}
        <Button
          type="primary"
          onClick={onQuery}
          loading={loading}
          disabled={selectedMonths.length === 0}
        >
          查询
        </Button>
      </Space>
    </Card>
  );
};

/**
 * 格式化月份显示
 * YYYY-MM → YYYY年M月
 */
const formatMonthDisplay = (month: string): string => {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m)}月`;
};

export default FilterPanel;
