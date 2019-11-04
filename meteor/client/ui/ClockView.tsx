import * as React from 'react'
import * as ClassNames from 'classnames'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as _ from 'underscore'

import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { Segment, Segments } from '../../lib/collections/Segments'

import { RundownTimingProvider, withTiming, WithTiming } from './RundownView/RundownTiming'
import { Parts, Part } from '../../lib/collections/Parts'
import { PartUi } from './SegmentTimeline/SegmentTimelineContainer'

import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, objectPathGet, extendMandadory } from '../../lib/lib'
import { PieceIconContainer, PieceNameContainer } from './PieceIcons/PieceIcon'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../lib/api/pubsub'
import { PartInstances, PartInstance, WrapPartToTemporaryInstance, FindPartInstanceOrWrapToTemporary } from '../../lib/collections/PartInstances'

interface SegmentUi extends Segment {
	partInstances: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface RundownOverviewProps {
	rundownId: string
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {
}
interface RundownOverviewTrackedProps {
	rundown?: Rundown
	segments: Array<SegmentUi>
}

const Timediff = class extends React.Component<{ time: number }> {
	render () {
		const time = -this.props.time
		const isNegative = (Math.floor(time / 1000) > 0)
		const timeString = RundownUtils.formatDiffToTimecode(time, true, false, true, false, true, '', false, true) // @todo: something happened here with negative time
		// RundownUtils.formatDiffToTimecode(this.props.displayTimecode || 0, true, false, true, false, true, '', false, true)
		// const timeStringSegments = timeString.split(':')
		// const fontWeight = (no) => no === '00' || no === '+00'
		return (
			<span className={ClassNames({
				'clocks-segment-countdown-red': isNegative,
				'clocks-counter-heavy': (time / 1000) > -30
			})}>
				{timeString}
			</span>
		)
	}
}

const ClockComponent = translate()(withTiming<RundownOverviewProps, RundownOverviewState>()(
	withTracker<WithTiming<RundownOverviewProps & InjectedTranslateProps>, RundownOverviewState, RundownOverviewTrackedProps>((props: RundownOverviewProps) => {

		let rundown: Rundown | undefined
		if (props.rundownId) rundown = Rundowns.findOne(props.rundownId)
		let segments: Array<SegmentUi> = []
		if (rundown) {
			segments = _.map(rundown.getSegments(), (segment) => {
				const displayDurationGroups: _.Dictionary<number> = {}
				const partInstances = segment.getPartInstances()
				const parts = _.map(segment.getParts(), part => FindPartInstanceOrWrapToTemporary(partInstances, part))
				let displayDuration = 0

				return extendMandadory<Segment, SegmentUi>(segment, {
					partInstances: _.map(parts, (partInstance, index) => {
						const part = partInstance.part
						if (part.displayDurationGroup && (
							(displayDurationGroups[part.displayDurationGroup]) ||
							// or there is a following member of this displayDurationGroup
							(parts[index + 1] && parts[index + 1].part.displayDurationGroup === part.displayDurationGroup))) {
							displayDurationGroups[part.displayDurationGroup] = (displayDurationGroups[part.displayDurationGroup] || 0) + ((part.expectedDuration || 0) - (partInstance.duration || 0))
							displayDuration = Math.max(0, Math.min(part.displayDuration || part.expectedDuration || 0, part.expectedDuration || 0) || displayDurationGroups[part.displayDurationGroup])
						}
						return extendMandadory<PartInstance, PartUi>(partInstance, {
							pieces: [],
							renderedDuration: part.expectedDuration ? 0 : displayDuration,
							startsAt: 0,
							willProbablyAutoNext: false
						})
					})
				})
			})

		}
		return {
			segments,
			rundown: rundown
		}
	})(
		class extends MeteorReactComponent<WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & InjectedTranslateProps>, RundownOverviewState> {
			componentWillMount () {
				this.subscribe(PubSub.rundowns, {
					_id: this.props.rundownId
				})
				this.subscribe(PubSub.segments, {
					rundownId: this.props.rundownId
				})
				this.subscribe(PubSub.parts, {
					rundownId: this.props.rundownId
				})
				this.subscribe(PubSub.partInstances, {
					rundownId: this.props.rundownId
				})
			}

			render () {
				const { rundown, segments } = this.props

				if (rundown && this.props.rundownId && this.props.segments) {
					let currentPart: PartUi | undefined
					let currentSegment: SegmentUi | undefined
					for (const segment of segments) {
						if (segment.partInstances) {
							for (const item of segment.partInstances) {
								if (item._id === rundown.currentPartInstanceId) {
									currentSegment = segment
									currentPart = item
								}
							}
						}
					}
					let currentSegmentDuration = 0
					if (currentPart) {
						currentSegmentDuration += currentPart.renderedDuration || currentPart.part.expectedDuration || 0
						currentSegmentDuration += -1 * (currentPart.duration || 0)
						if (!currentPart.duration && currentPart.timings.startedPlayback) {
							currentSegmentDuration += -1 * (getCurrentTime() - currentPart.timings.startedPlayback)
						}
					}

					let nextPart: PartUi | undefined
					let nextSegment: SegmentUi | undefined
					for (const segment of segments) {
						if (segment.partInstances) {
							for (const item of segment.partInstances) {
								if (item._id === rundown.nextPartInstanceId) {
									nextSegment = segment
									nextPart = item
								}
							}
						}
					}
					// let nextSegmentDuration = 0
					// if (nextPart) {
					// 	nextSegmentDuration += nextPart.expectedDuration || 0
					// 	nextSegmentDuration += -1 * (nextPart.duration || 0)
					// 	if (!nextPart.duration && nextPart.startedPlayback) {
					// 		nextSegmentDuration += -1 * (getCurrentTime() - nextPart.startedPlayback)
					// 	}
					// }

					const overUnderClock = rundown.expectedDuration ?
						(this.props.timingDurations.asPlayedRundownDuration || 0) - rundown.expectedDuration
						: (this.props.timingDurations.asPlayedRundownDuration || 0) - (this.props.timingDurations.totalRundownDuration || 0)

					return (
						<div className='clocks-full-screen'>
							<div className='clocks-half clocks-top'>
								{currentPart ?
									<React.Fragment>
										<div className='clocks-part-icon clocks-current-segment-icon'>
											<PieceIconContainer partId={currentPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
										</div>
										<div className='clocks-part-title clocks-current-segment-title'>
											{currentSegment!.name}
										</div>
										<div className='clocks-part-title clocks-part-title clocks-current-segment-title'>
											<PieceNameContainer partSlug={currentPart.part.title} partId={currentPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
										</div>
										<div className='clocks-current-segment-countdown clocks-segment-countdown'>
											<Timediff time={currentSegmentDuration} />
										</div>
									</React.Fragment> :
									rundown.expectedStart && <div className='clocks-rundown-countdown clocks-segment-countdown'>
										<Timediff time={rundown.expectedStart - getCurrentTime()} />
									</div>
								}
							</div>
							<div className='clocks-half clocks-bottom clocks-top-bar'>
								<div className='clocks-part-icon'>
									{nextPart ?
										<PieceIconContainer partId={nextPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
										: ''}
								</div>
								<div className='clocks-bottom-top'>
									<div className='clocks-part-title'>
										{currentPart && currentPart.part.autoNext ?
											<div style={{ display: 'inline-block', height: '18vh' }}>
												<img style={{ height: '12vh', paddingTop: '2vh' }} src='/icons/auto-presenter-screen.svg' />
											</div> : ''}
										{nextSegment && nextSegment.name ? nextSegment.name.split(';')[0] : '_'}
									</div>
									<div className='clocks-part-title clocks-part-title'>
										{nextPart && nextPart.part.title ?
											<PieceNameContainer partSlug={nextPart.part.title} partId={nextPart._id} showStyleBaseId={rundown.showStyleBaseId} rundownId={rundown._id} />
											: '_'}
									</div>
								</div>
								<div className='clocks-rundown-bottom-bar'>
									<div className='clocks-rundown-title'>
										{rundown ? rundown.name : 'UNKNOWN'}
									</div>
									<div className={ClassNames('clocks-rundown-total', {
										'over': (Math.floor(overUnderClock / 1000) >= 0)
									})}>
										{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true)}
									</div>
								</div>
							</div>
						</div>
					)
				}
				return null
			}
		})))

interface IPropsHeader extends InjectedTranslateProps {
	key: string
	rundown: Rundown
	segments: Array<Segment>
	parts: Array<Part>
	partInstances: Array<PartInstance>
	match: {
		params: {
			studioId: string
		}
	}
}

interface IStateHeader {
}

export const ClockView = translate()(withTracker(function (props: IPropsHeader) {
	let studioId = objectPathGet(props, 'match.params.studioId')
	let rundown = (
		Rundowns.findOne({
			active: true,
			studioId: studioId
		})
	)
	meteorSubscribe(PubSub.studios, {
		_id: studioId
	})

	// let dep = new Tracker.Dependency()
	// dep.depend()
	// Meteor.setTimeout(() => {
	// 	console.log('a')
	// 	dep.changed()
	// }, 3000)
	let segments = rundown ? Segments.find({ rundownId: rundown._id }, {
		sort: {
			'_rank': 1
		}
	}).fetch() : undefined
	let parts = rundown ? Parts.find({ rundownId: rundown._id }).fetch() : undefined
	let partInstances = rundown ? PartInstances.find({ rundownId: rundown._id }).fetch() : undefined
	// let rundownDurations = calculateDurations(rundown, parts)
	return {
		rundown,
		segments,
		parts,
		partInstances
	}
})(
	class extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
		componentDidMount () {
			document.body.classList.add('dark', 'xdark')
			let studioId = objectPathGet(this.props, 'match.params.studioId')
			if (studioId) {
				this.subscribe(PubSub.studios, {
					_id: studioId
				})
				this.subscribe(PubSub.rundowns, {
					active: true,
					studioId: studioId
				})
			}
			let rundown = (
				Rundowns.findOne({
					active: true,
					studioId: studioId
				})
			)
			if (rundown) {
				this.subscribe(PubSub.segments, {
					rundownId: rundown._id
				})
				this.subscribe(PubSub.parts, {
					rundownId: rundown._id
				})
				this.subscribe(PubSub.partInstances, {
					rundownId: rundown._id
				})
				this.subscribe(PubSub.pieces, {
					rundownId: rundown._id
				})
				this.subscribe(PubSub.pieceInstances, {
					rundownId: rundown._id
				})
				this.subscribe(PubSub.showStyleBases, {
					_id: rundown.showStyleBaseId
				})
				this.subscribe(PubSub.adLibPieces, {
					rundownId: rundown._id
				})
			}
		}

		componentWillUnmount () {
			this._cleanUp()
			document.body.classList.remove('dark', 'xdark')
		}

		render () {
			const { t } = this.props

			if (this.props.rundown) {
				return (
					<RundownTimingProvider rundown={this.props.rundown} >
						<ClockComponent rundownId={this.props.rundown._id} />
					</RundownTimingProvider>
				)
			} else {
				return (
					<div className='rundown-view rundown-view--unpublished'>
						<div className='rundown-view__label'>
							<p>
								{t('There is no rundown active in this studio.')}
							</p>
						</div>
					</div>
				)
			}
		}
	}
))
