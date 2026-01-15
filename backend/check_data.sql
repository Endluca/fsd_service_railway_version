-- 统计后端采集到的会话数
SELECT 
  date,
  SUM(array_length(processed_conversation_ids, 1)) as total_processed_conversations,
  COUNT(*) as sales_count,
  AVG(array_length(processed_conversation_ids, 1)) as avg_per_sales
FROM daily_metrics
WHERE date >= '2025-11-19' AND date <= '2025-11-19'
GROUP BY date;

-- 查看是否有销售没有数据
SELECT 
  open_user_id,
  meg_name,
  array_length(processed_conversation_ids, 1) as conversation_count
FROM daily_metrics dm
JOIN sales_person sp ON dm.open_user_id = sp.open_user_id
WHERE date = '2025-11-19'
ORDER BY conversation_count DESC;
