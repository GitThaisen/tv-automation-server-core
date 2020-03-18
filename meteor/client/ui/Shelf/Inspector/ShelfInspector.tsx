import * as React from 'react'
import { IModalAttributes, Modal } from '../../../lib/ui/containers/modals/Modal'
import renderItem from './ItemRenderers/ItemRendererFactory'
import { PieceGeneric } from '../../../../lib/collections/Pieces'

export { ShelfInspector }

interface IShelfInspectorProps {
	selected: PieceGeneric | undefined
}

class ShelfInspector extends React.Component<IShelfInspectorProps> {
	constructor (props: IShelfInspectorProps) {
		super(props)
	}

	render () {
		const {selected} = this.props;
		const content = selected && renderItem(selected)

		return (
			<div className="shelf-inspector">
				{content}
			</div>
		)
	}
}
