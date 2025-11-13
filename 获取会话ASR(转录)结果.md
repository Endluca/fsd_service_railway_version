获取会话ASR(转录)结果
最后更新于 2025年09月19日
功能：通过此接口获取单个会话的asr转录结果,结果文件2小时有效，请尽快下载
接口地址 Request URL：/openapi/conversation/v1/origin_conversations/:origin_conversation_id/asr_data
接口方法 Request Method：GET
限流等级说明：Medium
请求头 Request Headers
参数	描述	是否必须	类型	备注
Content-Type	固定值："application/json"	是	string	 
Authorization	值格式："Bearer access_token"	是	string	示例值："Bearer XMkTFe7mAAZpdwa3WBM6vZs7xoQhYiz3"
入参说明
路径参数 PathParam

参数	描述	类型	备注
origin_conversation_id	会话id	string	第三方系统的会话唯一id。
响应体示例
{
    "code": 0,
    "msg": "success",
    "data": {
        "conversation_type": "audio", // 会话类型 ：音频、视频、文本 枚举值 ["audio", "video", "doc"]
        "asr_file_url": "https://sale-test.oss-cn-zhangjiakou.aliyuncs.com/xx.json",  // ASR结果文本文件（过期时间2个小时）。
        "conversation_id": 169583,  // 会话id
    }
}
ASR文本文件内容 示例
[{
    "entity_id": 3015,  // 用户id
    "name": "张三",
    "entity_type": "host_salesman", // 用户类型：销售，客户   枚举值 ["host_salesman","customer_contact"]
    "content": "您拨打的电话暂时无法接通，我是机主的智能助理。您有什么事可以留言，我帮您转达。",  // 发言内容
    "begin_time": 0,  // 发言开始时间
    "end_time": 5.58,  // 发言结束时间
    "begin_percent": 0,  // 发言开始比例   计算公式：发言时间/总时间*100
    "end_percent": 17.89838337182448,  // 发言结束比例
    "channel": 0,  // 通道
    "order": 0  // 语句索引(从0开始)
},
{
    "entity_id": 6027,
    "name": "李四",
    "entity_type": "customer_contact",
    "content": "请问什么时候开会呢？",
    "begin_time": 25.48,
    "end_time": 27.64,
    "begin_percent": 81.7295355401591,
    "end_percent": 88.6579420066718,
    "channel": 0,
    "order": 1
}]
业务错误码
http状态码	code	msg	描述	排查建议
400

401200

conversation does not exist	会话不存在	 
400

401215

originId match Id failed	未根据传入的 第三方系统的会话唯一id 查询到 深维系统的会话id	 
500

501200

transcript unfinished,please try again later	转录未完成	转录未完成，请稍后再试
