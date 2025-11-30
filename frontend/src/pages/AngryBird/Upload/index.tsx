/**
 * 愤怒小鸟上传页面
 * 支持上传 xlsx 文件并导入数据
 */

import React, { useState } from 'react';
import { Upload, DatePicker, Button, message, Modal, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import type { Dayjs } from 'dayjs';
import * as angryBirdApi from '../../../services/angrybird';

const { Dragger } = Upload;
const { RangePicker } = DatePicker;

const AngryBirdUpload: React.FC = () => {
  const [fileList, setFileList] = useState<RcFile[]>([]);
  const [currentFile, setCurrentFile] = useState<RcFile | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);

  // 验证是否为完整的一周
  const validateWeekRange = (start: Dayjs, end: Dayjs): boolean => {
    if (start.day() !== 1) {
      message.error('开始日期必须是周一');
      return false;
    }
    if (end.day() !== 0) {
      message.error('结束日期必须是周日');
      return false;
    }
    const diff = end.diff(start, 'day');
    if (diff !== 6) {
      message.error('必须选择完整的一周（周一到周日）');
      return false;
    }
    return true;
  };

  const handleUpload = async (replace: boolean = false) => {
    if (!currentFile) {
      message.error('请选择文件');
      return;
    }

    if (!dateRange) {
      message.error('请选择日期范围');
      return;
    }

    const [start, end] = dateRange;
    if (!validateWeekRange(start, end)) {
      return;
    }

    setLoading(true);
    try {
      const result = await angryBirdApi.uploadFile(
        currentFile,
        start.format('YYYY-MM-DD'),
        end.format('YYYY-MM-DD'),
        replace
      );

      if (result.code === 0) {
        message.success(
          `导入成功！共导入 ${result.data?.importedCount} 条记录`
        );
        setFileList([]);
        setCurrentFile(null);
        setDateRange(null);
      } else if (result.code === 2) {
        // 需要确认覆盖
        Modal.confirm({
          title: '该周已有数据',
          content: `该周范围内已存在 ${result.data?.recordCount} 条记录，是否覆盖？`,
          onOk: () => handleUpload(true),
          okText: '覆盖',
          cancelText: '取消',
        });
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      message.error(error.response?.data?.message || '上传失败');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload: (file: RcFile) => {
      const isXlsx = file.name.endsWith('.xlsx');
      if (!isXlsx) {
        message.error('只支持 .xlsx 格式的文件');
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB');
        return false;
      }

      setCurrentFile(file);
      setFileList([file]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
      setCurrentFile(null);
    },
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <h4>选择日期范围（必须是完整的一周：周一到周日）</h4>
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
          format="YYYY-MM-DD"
          style={{ width: 300 }}
        />
      </div>

      <div>
        <h4>选择 Excel 文件</h4>
        <Dragger {...uploadProps} style={{ maxWidth: 600 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            仅支持 .xlsx 格式文件，文件大小不超过 10MB
          </p>
          <p className="ant-upload-hint" style={{ fontSize: 12, color: '#999' }}>
            必需列：会话ID、会话开始时间、客户、销售、成员所属部门、识别客户情绪、原文（原文可为空）
          </p>
        </Dragger>
      </div>

      <Button
        type="primary"
        onClick={() => handleUpload(false)}
        loading={loading}
        disabled={!currentFile || !dateRange}
      >
        开始导入
      </Button>
    </Space>
  );
};

export default AngryBirdUpload;
