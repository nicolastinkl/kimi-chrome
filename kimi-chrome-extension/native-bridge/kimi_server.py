#!/usr/bin/env python3
"""
Kimi CLI HTTP 桥接服务器

这个脚本启动一个本地 HTTP 服务器，将 Chrome 扩展的请求转发给本地 Kimi CLI。

使用方法:
1. 安装依赖: pip install flask kimi-cli
2. 运行服务器: python kimi_server.py
3. 服务器默认在 http://localhost:8765 启动
4. 在 Chrome 扩展中选择 "Kimi Code (本地 CLI)" 模式

可选参数:
    --port: 指定端口 (默认: 8765)
    --host: 指定主机 (默认: 127.0.0.1)
"""

import argparse
import json
import subprocess
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许跨域请求


def call_kimi_cli(prompt, system_prompt=None):
    """调用本地 Kimi CLI"""
    try:
        # 构建完整的提示词
        full_prompt = ""
        if system_prompt:
            full_prompt += f"[系统指令] {system_prompt}\n\n"
        full_prompt += prompt
        
        print(f"[Kimi CLI] 调用提示词: {full_prompt[:100]}...")
        
        # 构建命令
        cmd = ['kimi', '--print', '--quiet', '--prompt', full_prompt]
        
        # 执行命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5分钟超时
        )
        
        if result.returncode != 0:
            error_msg = result.stderr.strip() if result.stderr else "未知错误"
            print(f"[Kimi CLI] 错误: {error_msg}")
            return {
                'success': False,
                'error': f'Kimi CLI 错误: {error_msg}'
            }
        
        output = result.stdout.strip()
        print(f"[Kimi CLI] 输出长度: {len(output)} 字符")
        
        # 构建 OpenAI 兼容格式的响应
        response = {
            'success': True,
            'data': {
                'choices': [{
                    'message': {
                        'role': 'assistant',
                        'content': output
                    },
                    'finish_reason': 'stop'
                }],
                'model': 'kimi-for-coding',
                'usage': {
                    'prompt_tokens': len(full_prompt.split()),
                    'completion_tokens': len(output.split()),
                    'total_tokens': len(full_prompt.split()) + len(output.split())
                }
            }
        }
        
        return response
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'Kimi CLI 执行超时（超过5分钟）'
        }
    except FileNotFoundError:
        return {
            'success': False,
            'error': '找不到 kimi 命令，请确保已安装 kimi-cli: pip install kimi-cli'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'调用 Kimi CLI 失败: {str(e)}'
        }


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({'status': 'ok', 'service': 'kimi-cli-bridge'})


@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    """OpenAI 兼容的聊天完成端点"""
    try:
        data = request.json
        messages = data.get('messages', [])
        
        # 提取系统提示和用户提示
        system_prompt = None
        user_prompt = ""
        
        for msg in messages:
            if msg.get('role') == 'system':
                system_prompt = msg.get('content')
            elif msg.get('role') == 'user':
                user_prompt += msg.get('content', '') + "\n"
        
        user_prompt = user_prompt.strip()
        
        if not user_prompt:
            return jsonify({
                'success': False,
                'error': '没有提供用户提示'
            }), 400
        
        # 调用 Kimi CLI
        result = call_kimi_cli(user_prompt, system_prompt)
        
        if result['success']:
            return jsonify(result['data'])
        else:
            return jsonify({
                'error': {
                    'message': result['error'],
                    'type': 'api_error'
                }
            }), 500
            
    except Exception as e:
        return jsonify({
            'error': {
                'message': f'服务器错误: {str(e)}',
                'type': 'server_error'
            }
        }), 500


def main():
    parser = argparse.ArgumentParser(description='Kimi CLI HTTP 桥接服务器')
    parser.add_argument('--host', default='127.0.0.1', help='服务器主机 (默认: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8765, help='服务器端口 (默认: 8765)')
    args = parser.parse_args()
    
    print(f"=" * 60)
    print(f"Kimi CLI HTTP 桥接服务器")
    print(f"=" * 60)
    print(f"服务器地址: http://{args.host}:{args.port}")
    print(f"健康检查: http://{args.host}:{args.port}/health")
    print(f"API 端点: http://{args.host}:{args.port}/v1/chat/completions")
    print(f"=" * 60)
    print(f"请确保:")
    print(f"1. 已安装 kimi-cli: pip install kimi-cli")
    print(f"2. 已登录 Kimi: kimi login")
    print(f"3. 在 Chrome 扩展中选择 'Kimi Code (本地 CLI)' 模式")
    print(f"=" * 60)
    
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == '__main__':
    main()
