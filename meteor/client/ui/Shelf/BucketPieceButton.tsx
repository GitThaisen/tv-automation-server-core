import * as React from 'react'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import { ISourceLayer, IOutputLayer, SourceLayerType, VTContent, LiveSpeakContent } from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
import { IDashboardButtonProps, IDashboardButtonTrackedProps, DashboardPieceButtonBase } from './DashboardPieceButton'

import {
	DragSource,
	DropTarget,
	ConnectDragSource,
	ConnectDropTarget,
	DragSourceMonitor,
	DropTargetMonitor,
	ConnectDragPreview,
} from 'react-dnd'
import { DragDropItemTypes } from '../DragDropItemTypes'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { BucketAdLib } from '../../../lib/collections/BucketAdlibs'

type IDashboardButtonPropsCombined = BucketPieceButtonBaseProps & IDashboardButtonProps & IDashboardButtonTrackedProps

const buttonSource = {
	beginDrag(props: IDashboardButtonPropsCombined, monitor: DragSourceMonitor, component: any) {
		return {
			id: props.item._id,
			originalIndex: props.findAdLib(props.item._id).index
		}
	},

	endDrag(props: IDashboardButtonPropsCombined, monitor: DragSourceMonitor) {
		const { id: droppedId, originalIndex } = monitor.getItem()
		const didDrop = monitor.didDrop()

		if (!didDrop) {
			props.moveAdLib(droppedId, originalIndex)
		} else {
			const { index: newIndex } = monitor.getDropResult()
			
			props.onAdLibReorder(droppedId, newIndex)
		}
	}
}

const buttonTarget = {
	canDrop(props: IDashboardButtonPropsCombined, monitor: DropTargetMonitor) {
		return true
	},

	hover(props: IDashboardButtonPropsCombined, monitor: DropTargetMonitor, component: any) {
		const { id: draggedId } = monitor.getItem()
		const overId = props.item._id

		if (draggedId !== overId) {
			const { index: overIndex } = props.findAdLib(overId)
			props.moveAdLib(draggedId, overIndex)
		}
	},

	drop(props: IDashboardButtonPropsCombined, monitor: DropTargetMonitor) {
		const { index } = props.findAdLib(props.item._id)

		return {
			index
		}
	}
}

export interface BucketPieceButtonBaseProps {
	moveAdLib: (id: string, atIndex: number) => void
	findAdLib: (id: string) => { piece: BucketAdLib | undefined, index: number }
	onAdLibReorder: (draggedId: string, newIndex: number) => void
}

interface ButtonSourceCollectedProps {
	connectDragSource: ConnectDragSource
	connectDragPreview: ConnectDragPreview
	isDragging: boolean
}

interface ButtonTargetCollectedProps {
	connectDropTarget: ConnectDropTarget
}

export class BucketPieceButtonBase extends DashboardPieceButtonBase<ButtonSourceCollectedProps & ButtonTargetCollectedProps> {
	constructor(props) {
		super(props)
	}

	render() {
		const {
			isDragging,
			connectDragSource,
			connectDragPreview,
			connectDropTarget,
		} = this.props

		return connectDropTarget(connectDragSource(super.render()))
	}
}

export const BucketPieceButton = translateWithTracker<IDashboardButtonProps & BucketPieceButtonBaseProps, {}, IDashboardButtonTrackedProps>((props: IDashboardButtonProps) => {
	const piece = props.item as any as AdLibPieceUi

	const { status, metadata } = checkPieceContentStatus(piece, props.layer, props.rundown.getStudio().settings)

	return {
		status,
		metadata
	}
})(DropTarget(DragDropItemTypes.BUCKET_ADLIB_PIECE, buttonTarget, connect => ({
	connectDropTarget: connect.dropTarget(),
}))(DragSource(DragDropItemTypes.BUCKET_ADLIB_PIECE, buttonSource, (connect, monitor) => ({
	connectDragSource: connect.dragSource(),
	connectDragPreview: connect.dragPreview(),
	isDragging: monitor.isDragging(),
}))(BucketPieceButtonBase)))