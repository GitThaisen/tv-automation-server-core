import * as React from 'react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { unprotectString } from '../../lib/lib'
import { doModalDialog } from '../lib/ModalDialog'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import {
	Route,
	NavLink,
	Switch,
	Redirect
} from 'react-router-dom'

import { Studio, Studios } from '../../lib/collections/Studios'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ErrorBoundary } from '../lib/ErrorBoundary'

import StudioSettings from './Settings/StudioSettings'
import DeviceSettings from './Settings/DeviceSettings'
import ShowStyleSettings from './Settings/ShowStyleBaseSettings'
import SnapshotsView from './Settings/SnapshotsView'
import BlueprintSettings from './Settings/BlueprintSettings'
import SystemMessages from './Settings/SystemMessages'

import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { MigrationView } from './Settings/Migration'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import { PubSub, meteorSubscribe } from '../../lib/api/pubsub'
import { faExclamationTriangle } from '@fortawesome/fontawesome-free-solid'
import { MeteorCall } from '../../lib/api/methods'

class WelcomeToSettings extends React.Component {
	render () {
		return (<div></div>)
	}
}

interface ISettingsMenuProps {
	match?: any
}
interface ISettingsMenuState {
}
interface ISettingsMenuTrackedProps {
	studios: Array<Studio>
	showStyleBases: Array<ShowStyleBase>
	blueprints: Array<Blueprint>
	peripheralDevices: Array<PeripheralDevice>
}
const SettingsMenu = translateWithTracker<ISettingsMenuProps, ISettingsMenuState, ISettingsMenuTrackedProps >(() => {
	meteorSubscribe(PubSub.studios, {})
	meteorSubscribe(PubSub.showStyleBases, {})
	meteorSubscribe(PubSub.showStyleVariants, {})
	meteorSubscribe(PubSub.blueprints, {})
	meteorSubscribe(PubSub.peripheralDevices, {})

	return {
		studios: Studios.find({}).fetch(),
		showStyleBases: ShowStyleBases.find({}).fetch(),
		peripheralDevices: PeripheralDevices.find({}, {
			sort: {
				lastConnected: -1
			}}).fetch(),
		blueprints: Blueprints.find({}).fetch(),
	}
})(class SettingsMenu extends MeteorReactComponent<Translated<ISettingsMenuProps & ISettingsMenuTrackedProps>, ISettingsMenuState> {
	constructor (props: Translated<ISettingsMenuProps & ISettingsMenuTrackedProps>) {
		super(props)
		this.state = {
		}
	}

	statusCodeString (statusCode: PeripheralDeviceAPI.StatusCode) {
		let t = this.props.t

		switch (statusCode) {
			case PeripheralDeviceAPI.StatusCode.UNKNOWN:
				return t('Unknown')
			case PeripheralDeviceAPI.StatusCode.GOOD:
				return t('Good')
			case PeripheralDeviceAPI.StatusCode.WARNING_MINOR:
				return t('Minor Warning')
			case PeripheralDeviceAPI.StatusCode.WARNING_MAJOR:
				return t('Warning')
			case PeripheralDeviceAPI.StatusCode.BAD:
				return t('Bad')
			case PeripheralDeviceAPI.StatusCode.FATAL:
				return t('Fatal')
		}
	}

	studioHasError (studio: Studio) {
		if (!studio.name) return true
		if (!studio.supportedShowStyleBase.length) return true
		if (!studio.blueprintId) return true
		const peripherals = this.props.peripheralDevices
			.filter(device => device.studioId === studio._id)
		if (!peripherals.length) return true
		if (!peripherals.filter(device => device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT).length) return true
		return false
	}

	showStyleHasError (showstyle: ShowStyleBase) {
		if (!showstyle.sourceLayers) return true
		if (!showstyle.outputLayers) return true
		if (!showstyle.sourceLayers.length) return true
		if (!showstyle.outputLayers.length) return true
		if (!showstyle.outputLayers.filter(l => l.isPGM).length) return true
		return false
	}

	blueprintHasError (blueprint: Blueprint) {
		if (!blueprint.name) return true
		if (!blueprint.blueprintType) return true
		return false
	}

	peripheralDeviceHasError (device: PeripheralDevice) {
		if (!device.name) return true
		return false
	}

	connectedString (connected: boolean) {
		let t = this.props.t

		if (connected) {
			return t('Connected')
		} else {
			return t('Disconnected')
		}
	}

	deviceTypeString (type: PeripheralDeviceAPI.DeviceType) {
		let t = this.props.t

		switch (type) {
			case PeripheralDeviceAPI.DeviceType.MOS:
				return t('MOS Gateway')
			case PeripheralDeviceAPI.DeviceType.SPREADSHEET:
				return t('Spreadsheet Gateway')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Play-out Gateway')
			case PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER:
				return t('Media Manager')
			default:
				return t('Unknown Device')
		}
	}
	onAddStudio () {
		MeteorCall.studio.insertStudio().catch(console.error)
	}
	onAddShowStyleBase () {
		MeteorCall.showstyles.insertShowStyleBase().catch(console.error)
	}
	onAddBlueprint () {
		MeteorCall.blueprint.insertBlueprint().catch(console.error)
	}

	onDeleteStudio (studio: Studio) {
		const { t } = this.props
		doModalDialog({
			title: t('Delete this Studio?'),
			yes: t('Delete'),
			no: t('Cancel'),
			message: <React.Fragment>
				<p>{t('Are you sure you want to delete the studio "{{studioId}}"?', { studioId: studio.name })}</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</React.Fragment>,
			onAccept: () => {
				MeteorCall.studio.removeStudio(studio._id)
			}
		})
	}
	onDeleteShowStyleBase (item: ShowStyleBase) {
		const { t } = this.props
		doModalDialog({
			title: t('Delete this Show Style?'),
			yes: t('Delete'),
			no: t('Cancel'),
			message: <React.Fragment>
				<p>{t('Are you sure you want to delete the show style "{{showStyleId}}"?', { showStyleId: item && item.name })}</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</React.Fragment>,
			onAccept: () => {
				MeteorCall.showstyles.removeShowStyleBase(item._id)
			}
		})
	}
	onDeleteBlueprint (blueprint: Blueprint) {
		const { t } = this.props
		doModalDialog({
			title: t('Delete this Blueprint?'),
			yes: t('Delete'),
			no: t('Cancel'),
			message: <React.Fragment>
				<p>{t('Are you sure you want to delete the blueprint "{{blueprintId}}"?', { blueprintId: blueprint && blueprint.name })}</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</React.Fragment>,
			onAccept: () => {
				MeteorCall.blueprint.removeBlueprint(blueprint._id)
			}
		})
	}
	onDeleteDevice (device: PeripheralDevice) {
		const { t } = this.props
		doModalDialog({
			title: t('Remove this Device?'),
			yes: t('Delete'),
			no: t('Cancel'),
			message: <React.Fragment>
				<p>{t('Are you sure you want to remove the device "{{deviceName}}" and all of it\'s sub-devices?', { deviceName: device && device.name })}</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</React.Fragment>,
			onAccept: () => {
				MeteorCall.peripheralDevice.removePeripheralDevice(device._id).catch(console.error)
			}
		})
	}
	render () {
		const { t } = this.props

		return (
			<div className='tight-xs htight-xs text-s'>
				<h2 className='mhs'>
					<button className='action-btn right' onClick={() => this.onAddStudio()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Studios')}
				</h2>
				<hr className='vsubtle man' />
				{
					this.props.studios.map((studio) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={unprotectString(studio._id)} to={'/settings/studio/' + studio._id}>
								<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteStudio(studio) }}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
								{
									this.studioHasError(studio) ?
									<button className='action-btn right error-notice'>
										<FontAwesomeIcon icon={faExclamationTriangle} />
									</button> :
									null
								}
								<div className='selectable clickable'>
									<h3>{studio.name || t('Unnamed Studio')}</h3>
								</div>
							</NavLink>,
							<hr className='vsubtle man' key={studio._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>
					<button className='action-btn right' onClick={() => this.onAddShowStyleBase()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Show Styles')}
				</h2>
				<hr className='vsubtle man' />
				{
					this.props.showStyleBases.map((showStyleBase) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={unprotectString(showStyleBase._id)} to={'/settings/showStyleBase/' + showStyleBase._id}>
								<div className='selectable clickable'>
									<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteShowStyleBase(showStyleBase) }}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
									{
										this.showStyleHasError(showStyleBase) ?
										<button className='action-btn right error-notice'>
											<FontAwesomeIcon icon={faExclamationTriangle} />
										</button> :
										null
									}
									<h3>{showStyleBase.name || t('Unnamed Show Style')}</h3>
									{ showStyleBase.sourceLayers && showStyleBase.outputLayers &&
										<p>
											{t('Source Layers')}: {showStyleBase.sourceLayers.length.toString()} {t('Output Channels')}: {showStyleBase.outputLayers.length.toString()}
										</p>
									}
								</div>
							</NavLink>,
							<hr className='vsubtle man' key={showStyleBase._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>
					<button className='action-btn right' onClick={() => this.onAddBlueprint()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Blueprints')}
				</h2>
				<hr className='vsubtle man' />
				{
					this.props.blueprints.map((blueprint) => {
						return (
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={unprotectString(blueprint._id)} to={'/settings/blueprint/' + blueprint._id}>
								<div className='selectable clickable'>
									<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteBlueprint(blueprint) }}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
									{
										this.blueprintHasError(blueprint) ?
										<button className='action-btn right error-notice'>
											<FontAwesomeIcon icon={faExclamationTriangle} />
										</button> :
										null
									}
									<h3>{blueprint.name || t('Unnamed blueprint')}</h3>
									<p>{t('Type')} {(blueprint.blueprintType || '').toUpperCase()}</p>
									<p>{t('Version')} {blueprint.blueprintVersion}</p>
								</div>
								<hr className='vsubtle man' />
							</NavLink>
						)
					})
				}
				<h2 className='mhs'>{t('Devices')}</h2>
				<hr className='vsubtle man' />
				{
					this.props.peripheralDevices
					.filter((device) => {
						return device.subType === PeripheralDeviceAPI.SUBTYPE_PROCESS
					})
					.map((device) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={unprotectString(device._id)} to={'/settings/peripheralDevice/' + device._id}>
								<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteDevice(device) }}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
								{
									this.peripheralDeviceHasError(device) ?
									<button className='action-btn right error-notice'>
										<FontAwesomeIcon icon={faExclamationTriangle} />
									</button> :
									null
								}
								<h3>{device.name}</h3>
								<p>
									{device.connected ? t('Connected') : t('Disconnected')}, {t('Status')}: {this.statusCodeString(device.status.statusCode)}
								</p>
							</NavLink>,
							<hr className='vsubtle man' key={device._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>{t('Tools')}</h2>
				<hr className='vsubtle man' />
				<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' to='/settings/tools/messages'>
					<h3>{t('System Messages')}</h3>
				</NavLink>
				<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' to='/settings/tools/migration'>
					<h3>{t('Upgrade Database')}</h3>
				</NavLink>
				<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' to='/settings/tools/snapshots'>
					<h3>{t('Manage Snapshots')}</h3>
				</NavLink>
			</div>
		)
	}
})
interface ISettingsProps {
	match?: any
}
class Settings extends MeteorReactComponent<Translated<ISettingsProps>> {
	componentWillMount () {
		// Subscribe to data:
		this.subscribe(PubSub.peripheralDevices, {})
		this.subscribe(PubSub.studios, {})
		this.subscribe(PubSub.showStyleBases, {})
		this.subscribe(PubSub.showStyleVariants, {})
		this.subscribe(PubSub.blueprints, {})
	}
	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter has-statusbar'>
				<header className='mvs'>
					<h1>{t('System Settings')}</h1>
				</header>
				<div className='mod mvl mhs'>
					<div className='row'>
						<div className='col c12 rm-c3 settings-menu'>
							<ErrorBoundary>
								<SettingsMenu match={this.props.match} />
							</ErrorBoundary>
						</div>
						<div className='col c12 rm-c9 settings-dialog'>
							<ErrorBoundary>
								<Switch>
									<Route path='/settings' exact component={WelcomeToSettings} />
									<Route path='/settings/studio/:studioId' component={StudioSettings} />
									<Route path='/settings/showStyleBase/:showStyleBaseId' component={ShowStyleSettings} />
									<Route path='/settings/peripheralDevice/:deviceId' component={DeviceSettings} />
									<Route path='/settings/blueprint/:blueprintId' component={BlueprintSettings} />
									<Route path='/settings/tools/snapshots' component={SnapshotsView} />
									<Route path='/settings/tools/migration' component={MigrationView} />
									<Route path='/settings/tools/messages' component={SystemMessages} />
									<Redirect to='/settings' />
								</Switch>
							</ErrorBoundary>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Settings)
