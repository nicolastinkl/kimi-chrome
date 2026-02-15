#!/usr/bin/env python3
"""
Kimi CLI 桥接程序 - 允许 Chrome 扩展调用本地 Kimi CLI

安装步骤:
1. 确保已安装 kimi-cli: pip install kimi-cli
2. 运行此脚本: python kimi_bridge.py
3. 在 Chrome 扩展中选择 "Kimi Code (本地 CLI)" 模式
"""

import sys
import json
import subprocess
import os


def read_message():
    """从 stdin 读取 Chrome 扩展发送的消息"""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = int.from_bytes(raw_length, byteorder='little')
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(message):
    """向 Chrome 扩展发送消息"""
    encoded_message = json.dumps(message).encode('utf-8')
    message_length = len(encoded_message)
    sys.stdout.buffer.write(message_length.to_bytes(4, byteorder='little'))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()


def call_kimi_cli(prompt, system_prompt=None):
    """调用本地 Kimi CLI"""
    try:
        # 构建完整的提示词
        full_prompt = ""
        if system_prompt:
            full_prompt += f"[系统指令] {system_prompt}\n\n"
        full_prompt += prompt
        
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
            return {
                'success': False,
                'error': f'Kimi CLI 错误: {result.stderr}'
            }
        
        # 构建 OpenAI 兼容格式的响应
        response = {
            'success': True,
            'data': {
                'choices': [{
                    'message': {
                        'role': 'assistant',
                        'content': result.stdout.strip()
                    },
                    'finish_reason': 'stop'
                }],
                'model': 'kimi-for-coding',
                'usage': {
                    'prompt_tokens': len(full_prompt.split()),
                    'completion_tokens': len(result.stdout.strip().split()),
                    'total_tokens': len(full_prompt.split()) + len(result.stdout.strip().split())
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


def main():
    """主循环"""
    while True:
        try:
            message = read_message()
            if message is None:
                break
            
            action = message.get('action')
            
            if action == 'callKimiCLI':
                prompt = message.get('prompt', '')
                system_prompt = message.get('system_prompt')
                result = call_kimi_cli(prompt, system_prompt)
                send_message(result)
            else:
                send_message({
                    'success': False,
                    'error': f'未知操作: {action}'
                })
                
        except Exception as e:
            send_message({
                'success': False,
                'error': f'桥接程序错误: {str(e)}'
            })


if __name__ == '__main__':
    main()
