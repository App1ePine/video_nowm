<script setup lang="js">
import axios from 'axios'

const downloadKey = ref('')
const formRef = ref(null)
const formData = ref({
	inputText: '',
})
const urlPattern = /https?:\/\/[^\s]+/
const shareUrl = computed(() => {
	const match = formData.value.inputText.match(urlPattern)
	return match ? match[0] : ''
})
const isValidInput = computed(() => {
	return formData.value.inputText.trim() !== '' && urlPattern.test(formData.value.inputText)
})
const rules = {
	inputText: [
		{ required: true, message: '请输入分享链接或者带链接的分享文本', trigger: 'blur' },
		{
			validator: (rule, value, callback) => {
				if (!value || !urlPattern.test(value)) {
					callback(new Error('请输入有效的URL或包含URL的文本'))
				} else {
					callback()
				}
			},
			trigger: 'blur',
		},
	],
}
const handleParse = async () => {
	if (formRef.value) {
		try {
			await formRef.value.validate()
			ElMessage.success('验证通过，开始解析...')
			// 请求后端
			try {
				const response = await axios.post('/api/parse', {
					shareUrl: shareUrl.value,
				})
				if (response.data && response.data.success) {
					resRef.value = response.data.data
					console.log(resRef.value.video2)
				} else {
					ElMessage.error('解析失败')
				}
			} catch (e) {
				ElMessage.error('解析失败，请稍后再试')
				console.error('解析错误: ', e)
			}
		} catch (e) {
			ElMessage.error('验证失败，请检查输入内容')
			return
		}
	}
}
const resRef = ref(null)
// 下载视频
const handleDownload = async () => {
	if (resRef.value && resRef.value.video2) {
		if (!downloadKey.value.trim()) {
			ElMessage.error('请输入下载密钥')
			return
		}
		try {
			// 使用后端代理下载
			const downloadUrl = `/api/download?key=${downloadKey.value}&url=${encodeURIComponent(resRef.value.video2)}`
			// 判断是否为移动端
			const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
			if (isMobile) {
				// 直接跳转下载链接
				window.location.href = resRef.value.video2
				ElMessage.success('正在跳转下载...')
				return
			}
			try {
				const response = await axios.get(downloadUrl, {
					responseType: 'blob',
				})
				const blob = new Blob([response.data], { type: response.data.type || 'video/mp4' })
				const link = document.createElement('a')
				link.href = URL.createObjectURL(blob)
				link.download = `douyin_video_${resRef.value.title}.mp4`
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)
				URL.revokeObjectURL(link.href)
				ElMessage.success('开始下载视频')
			} catch (error) {
				console.error('下载失败:', error)
				ElMessage.error('下载失败')
			}
		} catch (error) {
			console.error('下载失败:', error)
			ElMessage.error('下载失败')
		}
	} else {
		ElMessage.error('没有可下载的视频链接')
	}
}
// 复制视频链接
const copyVideoLink = () => {
	if (resRef.value && resRef.value.video2) {
		navigator.clipboard.writeText(resRef.value.video2)
		ElMessage.success('视频链接已复制到剪贴板')
	}
}
</script>

<template>
	<div class="app-container">
		<el-row :gutter="24" id="header-card-container">
			<el-col :xl="7" :lg="6" :md="4" :sm="2" :xs="0"></el-col>
			<el-col :xl="10" :lg="12" :md="16" :sm="20" :xs="24">
				<el-card>
					<template #header>
						<div class="card-header">
							<span>视频解析</span>
						</div>
					</template>
					<div></div>
				</el-card>
			</el-col>
		</el-row>
		<el-row :gutter="24" class="card-container">
			<el-col :xl="7" :lg="6" :md="4" :sm="2" :xs="0"></el-col>
			<el-col :xl="10" :lg="12" :md="16" :sm="20" :xs="24">
				<el-card>
					<template #header>
						<div class="card-header">
							<span>输入</span>
						</div>
					</template>
					<div>
						<el-form ref="formRef" :model="formData" :rules="rules">
							<el-form-item label="分享内容：" prop="inputText">
								<el-input
									v-model="formData.inputText"
									autosize
									large
									type="textarea"
									placeholder="输入分享文本或链接"
									:class="{
										'valid-input': isValidInput,
										'invalid-input': formData.inputText && !isValidInput,
									}"
								/>
							</el-form-item>
							<el-button type="warning" class="full-width-btn" @click="formRef.resetFields()"
								>重置输入</el-button
							>
							<el-button
								type="primary"
								class="full-width-btn"
								@click="handleParse"
								:disabled="!isValidInput"
								>解析抖音</el-button
							>
						</el-form>
					</div>
				</el-card>
			</el-col>
		</el-row>
		<el-row :gutter="24" v-if="resRef" class="card-container">
			<el-col :xl="7" :lg="6" :md="4" :sm="2" :xs="0"></el-col>
			<el-col :xl="10" :lg="12" :md="16" :sm="20" :xs="24">
				<el-card>
					<template #header>
						<div class="card-header">
							<span>解析结果</span>
						</div>
					</template>
					<div>
						<!-- 视频显示区域 -->
						<div
							style="
								display: flex;
								justify-content: center;
								align-items: center;
								margin-bottom: 16px;
							"
						>
							<iframe
								:src="resRef.video2"
								allowfullscreen
								referrerpolicy="no-referrer"
								sandbox="allow-scripts allow-same-origin"
								frameborder="0"
								style="min-height: 400px; width: 100%"
							></iframe>
						</div>
						<!-- 下载密钥输入 -->
						<div style="margin-bottom: 16px">
							<el-input
								v-model="downloadKey"
								placeholder="输入下载密钥，没有的话复制链接自行下载"
								type="password"
								show-password
								style="width: 100%"
							>
								<template #prepend>下载密钥</template>
							</el-input>
						</div>
						<!-- 按钮区域 -->
						<div>
							<el-button
								type="primary"
								class="full-width-btn"
								@click="handleDownload"
								v-if="resRef.video2"
								:disabled="!downloadKey.trim()"
							>
								下载视频
							</el-button>
							<el-button
								type="success"
								class="full-width-btn"
								@click="copyVideoLink"
								v-if="resRef.video2"
							>
								复制视频链接自行下载
							</el-button>
						</div>
					</div>
				</el-card>
			</el-col>
		</el-row>
	</div>
</template>

<style scoped>
#header-card-container {
	margin-top: 40px;
	margin-bottom: 20px;
}
.valid-input {
	border-color: #67c23a;
}

.invalid-input {
	border-color: #f56c6c;
}
.full-width-btn {
	width: 100%;
	margin-left: 0;
	margin-right: 0;
	margin-bottom: 4px;
}
.card-container {
	margin-bottom: 20px;
}
</style>
