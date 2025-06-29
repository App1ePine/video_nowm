import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { writeFileSync } from 'fs'
import { join } from 'path'

const app = new Hono()

const DOWNLOAD_KEY = 'djl'

app.use('/api/*', cors())

app.get('/', (c) => {
	return c.text('抖音视频解析API - 使用 /api/parse POST 提交 shareUrl 参数（形如：https://v.douyin.com/IqPTpKdCngY/）')
})

// 获取重定向地址
async function getRedirectedUrl(url: string): Promise<string> {
	try {
		const response = await fetch(url, {
			method: 'HEAD',
			redirect: 'follow',
		})
		return response.url
	} catch (e) {
		console.error('Error fetching URL:', e)
		throw new Error('Failed to fetch the URL')
	}
}

app.post('/api/parse', async (c) => {
	try {
		let body
		try {
			body = await c.req.json()
		} catch (e) {
			return c.json({ error: 'Invalid request body' }, 400)
		}
		const shareUrl = body.shareUrl || undefined
		if (!shareUrl) {
			return c.json({ error: 'Missing shareUrl parameter' }, 400)
		}
		let videoId: string
		const redirectedUrl = await getRedirectedUrl(shareUrl)
		const idMatch = redirectedUrl.match(/(\d+)/)
		if (!idMatch) {
			return c.json({ error: 'Failed to extract video ID from URL' }, 400)
		}
		videoId = idMatch[1]
		const headers = {
			'User-Agent':
				'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
			Referer: 'https://www.douyin.com/?is_from_mobile_home=1&recommend=1',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
			'Accept-Encoding': 'gzip, deflate, br',
			'Connection': 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
		}
		const url = `https://www.iesdouyin.com/share/video/${videoId}/`
		const response = await fetch(url, { headers })
		if (!response.ok) {
			return c.json({ error: 'Failed to fetch video data' }, 500)
		}
		const html = await response.text()
		const routerDataMatch = html.match(/_ROUTER_DATA\s*=\s*(\{.*?\})</)
		if (!routerDataMatch) {
			return c.json({ error: 'Failed to extract router data' }, 500)
		}
		const jsonData = JSON.parse(routerDataMatch[1])
		const itemList = jsonData?.loaderData?.['video_(id)/page']?.videoInfoRes?.item_list?.[0]
		if (!itemList) {
			return c.json({ error: '视频数据格式异常' }, 500)
		}
		const nickname = itemList.author?.nickname
		const title = itemList.desc
		const awemeId = itemList.aweme_id
		const video = itemList.video?.play_addr?.uri
		const video2 = await getRedirectedUrl(
			itemList.video?.play_addr?.url_list?.[0]
				.replace(/playwm/, 'play')
				.replace(/ratio=\d+p/, 'ratio=3840p'),
		)
		const videoUrl = video
			? video.includes('mp3')
				? video
				: `https://www.douyin.com/aweme/v1/play/?video_id=${video}`
			: null
		const cover = itemList.video?.cover?.url_list?.[0]
		// const images = itemList.images
		if (!nickname || !videoUrl) {
			return c.json({
				success: false,
				message: '解析失败，可能是视频已被删除或者接口变更',
			})
		}
		return c.json({
			success: true,
			message: '解析成功',
			data: {
				name: nickname,
				awemeId: awemeId,
				title: title,
				video: videoUrl,
				video2: video2 || null,
				cover: cover,
				// images: images ? images.map((image: any) => image.url_list[0]) : [],
				// type: images ? '图集' : '视频',
			},
		})
	} catch (error) {
		console.error('解析错误:', error)
		return c.json({ error: '服务器内部错误' }, 500)
	}
})

app.get('/api/download', async (c) => {
	const videoUrl = c.req.query('url')
	const providedKey = c.req.query('key')
	if (!providedKey) {
		return c.json({ error: 'Missing download key' }, 401)
	}
	if (!videoUrl) {
		return c.json({ error: 'Missing video URL' }, 400)
	}
	try {
		// 验证密钥
		if (providedKey !== DOWNLOAD_KEY) {
			return c.json({ error: 'Invalid download key' }, 403)
		}

		const headers = {
			'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
			Referer: 'https://www.douyin.com/',
			Accept: '*/*',
		}

		const response = await fetch(decodeURIComponent(videoUrl), { headers })

		if (!response.ok) {
			return c.text('Video not found', 404)
		}

		// 设置下载响应头
		c.header('Content-Type', 'video/mp4')
		c.header('Content-Disposition', 'attachment; filename="douyin_video.mp4"')
		c.header('Content-Length', response.headers.get('Content-Length') || '0')

		return new Response(response.body, {
			headers: c.res.headers,
		})
	} catch (error) {
		console.error('下载错误:', error)
		return c.text('Internal server error', 500)
	}
})

export default {
	port: 30001,
	fetch: app.fetch,
}
