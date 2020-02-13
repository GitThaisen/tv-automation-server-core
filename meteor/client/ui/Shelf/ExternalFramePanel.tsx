import * as React from 'react'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import {
	RundownLayoutExternalFrame,
	RundownLayoutBase,
	DashboardLayoutExternalFrame
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { literal, protectString } from '../../../lib/lib'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { parseMosPluginMessageXml, MosPluginMessage } from '../../lib/parsers/mos/mosXml2Js'
import {
	createMosAppInfoXmlString,
	UIMetric as MOSUIMetric,
	UIMetricMode as MOSUIMetricMode,
	createMosItemRequest
} from '../../lib/data/mos/plugin-support'
import { MODULE_BROWSER_ORIGIN } from './Inspector/ItemRenderers/NoraItemEditor'
import { IMOSItem } from 'mos-connection'
import { doUserAction } from '../../lib/userAction'
import { translate } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Buckets } from '../../../lib/collections/Buckets'
import { IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { MeteorCall } from '../../../lib/api/methods'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'

const PackageInfo = require('../../../package.json')

interface IProps {
	layout: RundownLayoutBase
	panel: RundownLayoutExternalFrame
	visible: boolean
	playlist: RundownPlaylist
}

enum SofieExternalMessageType {
	HELLO = 'hello',
	WELCOME = 'welcome',
	ACK = 'ack',
	NAK = 'nak',
	KEYBOARD_EVENT = 'keyboard_event',
	CURRENT_PART_CHANGED = 'current_part_changed',
	NEXT_PART_CHANGED = 'next_part_changed',
	FOCUS_IN = 'focus_in'
}

interface SofieExternalMessage {
	id: string,
	replyToId?: string
	type: SofieExternalMessageType
	payload?: any
}

interface HelloSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.HELLO
	payload: never
}

interface WelcomeSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.WELCOME
	payload: {
		host: string
		version: string
		rundownPlaylistId: RundownPlaylistId
	}
}

interface KeyboardEventSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.KEYBOARD_EVENT
	payload: KeyboardEvent & {
		currentTarget: null,
		path: null,
		scrElement: null,
		target: null,
		view: null
	}
}

interface CurrentNextPartChangedSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.CURRENT_PART_CHANGED | SofieExternalMessageType.NEXT_PART_CHANGED
	payload: {
		partInstanceId: PartInstanceId | null
		prevPartInstanceId?: PartInstanceId | null
	}
}

export const ExternalFramePanel = translate()(class ExternalFramePanel extends React.Component<Translated<IProps>> {
	frame: HTMLIFrameElement
	mounted: boolean = false
	initialized: boolean = false

	awaitingReply: {
		[key: string]: {
			resolve: Function
			reject: Function
		}
	} = {}

	setElement = (frame: HTMLIFrameElement) => {
		this.frame = frame
		if (this.frame && !this.mounted) {
			this.registerHandlers()
			this.mounted = true
		} else {
			this.unregisterHandlers()
			this.mounted = false
		}
	}

	onKeyEvent = (e: KeyboardEvent) => {
		this.sendSofieMessage(literal<SofieExternalMessage>({
			id: Random.id(),
			type: SofieExternalMessageType.KEYBOARD_EVENT,
			// Send the event sanitized to prevent sending huge objects
			payload: _.omit(_.omit(e,
				['currentTarget',
					'path',
					'srcElement',
					'target',
					'view',
					'sourceCapabilities']
			), (value, key) => typeof value === 'function')
		}))
	}

	onReceiveMessage = (e: MessageEvent) => {
		if (e.origin === 'null' && this.frame && e.source === this.frame.contentWindow) {
			const data = e.data || e['message']
			if (!data) return
			if (data.type) {
				this.actSofieMessage(data)
			} else {
				this.actMOSMessage(e, data)
			}
		}
	}

	actMOSMessage = (e: any, message: any) => {
		const data: MosPluginMessage | undefined = parseMosPluginMessageXml(message)

		if (data) {
			return this.handleMosMessage(e, data)
		}
	}

	sendMOSAppInfo() {
		let uiMetrics: MOSUIMetric[] | undefined = undefined
		if (this.frame) {
			const size = this.frame.getClientRects().item(0)
			if (size) {
				uiMetrics = [
					literal<MOSUIMetric>({
						startx: size.left,
						starty: size.top,
						endx: size.left + size.width,
						endy: size.top + size.height,
						mode: MOSUIMetricMode.Contained
					})
				]
			}
		}
		this.sendMOSMessage(createMosAppInfoXmlString(uiMetrics))
	}

	receiveMOSItem(e: any, mosItem: IMOSItem) {
		const { t, playlist } = this.props

		const targetBucket = Buckets.findOne()
		let targetRundown: Rundown | undefined
		let currentPart
		if (playlist.currentPartInstanceId || playlist.nextPartInstanceId) {
			if (playlist.currentPartInstanceId !== null) {
				currentPart = PartInstances.findOne(playlist.currentPartInstanceId)
			} else if (playlist.nextPartInstanceId !== null) {
				currentPart = PartInstances.findOne(playlist.nextPartInstanceId)
			}
			targetRundown = Rundowns.findOne(currentPart)
		} else {
			targetRundown = playlist.getRundowns[0]
		}

		if (!targetRundown) {
			throw new Meteor.Error('Target rundown could not be found!')
			return
		}

		doUserAction(t, e, 'Importing bucket Ad-Lib', (e) =>
			MeteorCall.userAction.bucketAdlibImport(e,
				playlist.studioId,
				targetRundown!.showStyleVariantId,
				targetBucket ? targetBucket._id : protectString(''),
				literal<IngestAdlib>({
					externalId: mosItem.ObjectID ? mosItem.ObjectID.toString() : '',
					name: mosItem.ObjectSlug ? mosItem.ObjectSlug.toString() : '',
					payloadType: 'MOS',
					payload: mosItem
				})
			)
		)
	}

	handleMosMessage = (e: any, mos: MosPluginMessage) => {
		if (mos.ncsReqAppInfo) {
			this.sendMOSAppInfo()
		} else if (mos.item) {
			this.receiveMOSItem(e, mos.item)
		}
	}

	actSofieMessage = (message: SofieExternalMessage) => {
		check(message.id, String)
		check(message.type, String)

		if (_.values(SofieExternalMessageType).indexOf(message.type) < 0) {
			console.error(`ExternalFramePanel: Unknown message type: ${message.type}`)
			return
		}

		if (message.replyToId && this.awaitingReply[message.replyToId]) {
			this.awaitingReply[message.replyToId].resolve(message)
			delete this.awaitingReply[message.replyToId]
			return
		}

		switch (message.type) {
			// perform a three-way handshake: HELLO -> WELCOME -> ACK
			case SofieExternalMessageType.HELLO:
				this.sendSofieMessageAwaitReply(literal<WelcomeSofieExternalMessage>({
					id: Random.id(),
					replyToId: message.id,
					type: SofieExternalMessageType.WELCOME,
					payload: {
						host: 'Sofie Automation System',
						version: PackageInfo.version,
						rundownPlaylistId: this.props.playlist._id
					}
				}), true).then((e) => {
					if (e.type === SofieExternalMessageType.ACK) {
						this.initialized = true
						this.sendSofieCurrentState()
					}
				}).catch(e => console.warn)
				break
			case SofieExternalMessageType.FOCUS_IN:
				this.sendSofieMessage(literal<SofieExternalMessage>({
					id: Random.id(),
					replyToId: message.id,
					type: SofieExternalMessageType.ACK
				}))
				const randomEl = document.querySelector('button')
				if (randomEl) randomEl.focus()
				break
		}
	}

	sendSofieMessageAwaitReply = (message: SofieExternalMessage, uninitialized?: boolean): Promise<SofieExternalMessage> => {
		return new Promise((resolve, reject) => {
			if (this.initialized || uninitialized) {
				this.awaitingReply[message.id] = { resolve, reject }
				this.sendSofieMessage(message, uninitialized)
			} else {
				reject(new Error('ExternalFramePanel guest not initialized'))
			}
		})
	}

	sendSofieMessage = (data: SofieExternalMessage, uninitialized?: boolean) => {
		if (this.frame && this.frame.contentWindow && (this.initialized || uninitialized)) {
			this.frame.contentWindow.postMessage(data, '*')
		}
	}

	sendMOSMessage = (data: string) => {
		if (this.frame && this.frame.contentWindow) {
			this.frame.contentWindow.postMessage(data, MODULE_BROWSER_ORIGIN)
		}
	}

	sendSofieCurrentState() {
		this.sendSofieMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
			id: Random.id(),
			type: SofieExternalMessageType.CURRENT_PART_CHANGED,
			payload: {
				partInstanceId: this.props.playlist.currentPartInstanceId
			}
		}))
		this.sendSofieMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
			id: Random.id(),
			type: SofieExternalMessageType.NEXT_PART_CHANGED,
			payload: {
				partInstanceId: this.props.playlist.nextPartInstanceId
			}
		}))
	}

	onDragOver = (e: DragEvent) => {
		let dragAllowed = false
		if (e.dataTransfer) {
			if (e.dataTransfer.getData('Text').trim().endsWith('</mos>')) {
				// this is quite probably a MOS object
				dragAllowed = true
			} else if (
				e.dataTransfer.items.length === 0 &&
				e.dataTransfer.types.length === 0 &&
				e.dataTransfer.files.length === 0
			) {
				// it might be a MOS object, but we can't know
				dragAllowed = true
			}

			if (dragAllowed) {
				e.dataTransfer.dropEffect = 'copy'
				e.dataTransfer.effectAllowed = 'copy'
			}
		}

		e.preventDefault()
	}

	onDropEnter = (e: DragEvent) => {
		e.preventDefault()
	}

	onDrop = (e: DragEvent) => {
		if (e.dataTransfer) {
			if (e.dataTransfer.getData('Text').trim().endsWith('</mos>')) {
				// this is quite probably a MOS object, let's try and ingest it
				this.actMOSMessage(e, e.dataTransfer.getData('Text'))
			} else if (e.dataTransfer.items.length === 0 && e.dataTransfer.types.length === 0 && e.dataTransfer.files.length === 0) {
				// there are no items, no data types and no files, this is probably a cross-frame drag-and-drop
				// let's try and ask the plugin for some content maybe?
				this.sendMOSMessage(createMosItemRequest())
			}
		}
	}

	registerHandlers = () => {
		document.addEventListener('keydown', this.onKeyEvent)
		document.addEventListener('keyup', this.onKeyEvent)

		document.addEventListener('dragover', this.onDragOver)
		document.addEventListener('dropenter', this.onDropEnter)
		document.addEventListener('drop', this.onDrop)
	}

	unregisterHandlers = () => {
		document.removeEventListener('keydown', this.onKeyEvent)
		document.removeEventListener('keydown', this.onKeyEvent)
	}

	componentDidUpdate(prevProps: IProps) {
		if (prevProps.playlist.currentPartInstanceId !== this.props.playlist.currentPartInstanceId) {
			this.sendSofieMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
				id: Random.id(),
				type: SofieExternalMessageType.CURRENT_PART_CHANGED,
				payload: {
					partInstanceId: this.props.playlist.currentPartInstanceId,
					prevPartInstanceId: prevProps.playlist.currentPartInstanceId
				}
			}))
		}

		if (prevProps.playlist.nextPartInstanceId !== this.props.playlist.nextPartInstanceId) {
			this.sendSofieMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
				id: Random.id(),
				type: SofieExternalMessageType.NEXT_PART_CHANGED,
				payload: {
					partInstanceId: this.props.playlist.nextPartInstanceId,
					prevPartInstanceId: prevProps.playlist.nextPartInstanceId
				}
			}))
		}
	}

	componentDidMount() {
		window.addEventListener('message', this.onReceiveMessage)
	}

	componentWillUnmount() {
		// reject all outstanding promises for replies
		_.each(this.awaitingReply, (promise) => promise.reject(new Error('ExternalFramePanel unmounting')))
		this.unregisterHandlers()
		window.removeEventListener('message', this.onReceiveMessage)
	}

	render() {
		return <div className='external-frame-panel'
			style={
				_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout) ?
						dashboardElementPosition(this.props.panel as DashboardLayoutExternalFrame) :
						{},
					{
						'visibility': this.props.visible ? 'visible' : 'hidden'
					}
				)
			}>
			<iframe
				ref={this.setElement}
				className='external-frame-panel__iframe'
				src={this.props.panel.url}
				sandbox='allow-forms allow-popups allow-scripts'></iframe>
		</div>
	}
})
