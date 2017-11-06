/** @format */
/**
 * External dependencies
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { filter, forEach, get, head, noop, reduce, uniqBy, values } from 'lodash';
import { localize } from 'i18n-calypso';

/**
 * Internal dependencies
 */
import Button from 'components/button';
import Count from 'components/count';
import { fetchProductVariations } from 'woocommerce/state/sites/product-variations/actions';
import formatCurrency from 'lib/format-currency';
import formattedVariationName from 'woocommerce/lib/formatted-variation-name';
import FormLabel from 'components/forms/form-label';
import FormRadio from 'components/forms/form-radio';
import FormCheckbox from 'components/forms/form-checkbox';
import { getPaymentCurrencySettings } from 'woocommerce/state/sites/settings/general/selectors';
import { getSelectedSiteWithFallback } from 'woocommerce/state/sites/selectors';
import { getVariationsForProduct } from 'woocommerce/state/sites/product-variations/selectors';
import { isProductSelected } from './utils';
import ProductVariations from './variations';

class ProductSearchRow extends Component {
	static propTypes = {
		onChange: PropTypes.func,
		product: PropTypes.object.isRequired,
		singular: PropTypes.bool,
		value: PropTypes.oneOfType( [ PropTypes.number, PropTypes.array ] ),
	};

	static defaultProps = {
		onChange: noop,
		singular: false,
		value: [],
	};

	state = {
		showForm: false,
		variations: [],
	};

	componentDidMount() {
		const { siteId, product, productId } = this.props;

		if ( siteId && productId ) {
			if ( ! product || 'variable' !== product.type ) {
				return;
			}
			this.props.fetchProductVariations( siteId, productId );
		}
	}

	componentWillReceiveProps( newProps ) {
		// Short out if we know the new product doesn't need variations
		if ( ! newProps.product || 'variable' !== newProps.product.type ) {
			return;
		}

		const { oldSiteId, oldProductId } = this.props;
		const { newSiteId, newProductId } = newProps;

		if ( oldSiteId !== newSiteId || oldProductId !== newProductId ) {
			this.props.fetchProducts( newSiteId, newProductId );
		}
	}

	isSelected = id => isProductSelected( this.props.value, id );

	onChange = event => {
		const productId = Number( event.target.value );
		this.setState(
			prevState => ( {
				variations: filter( prevState.variations, item => item.id !== productId ),
			} ),
			() => {
				this.props.onChange( productId );
			}
		);
	};

	toggleCustomizeForm = () => {
		this.setState( prevState => {
			// Open form
			if ( ! prevState.showForm ) {
				return { showForm: true };
			}
			// Only close form if nothing's selected
			if ( prevState.showForm && ! this.areAnySelected() ) {
				return { showForm: false };
			}
		} );
	};

	updateItem = attributes => {
		const { variations } = this.props;
		// Don't swap the product if we have an "any" selected
		if ( -1 !== values( attributes ).indexOf( 'any' ) ) {
			return;
		}
		// Using filter instead of find to make sure we find exactly one match.
		const matchingVariations = filter( variations, v => {
			return reduce(
				v.attributes,
				( result, a ) => {
					return result && attributes[ a.name ] === a.option;
				},
				true
			);
		} );
		if ( matchingVariations.length === 1 ) {
			// We found a match.
			const variation = head( matchingVariations );
			this.setState(
				prevState => ( {
					variations: uniqBy( [ ...prevState.variations, variation ], 'id' ),
				} ),
				() => {
					this.props.onChange( this.props.product.id );
					forEach( this.state.variations, v => this.props.onChange( v.id ) );
				}
			);
			return;
		}
	};

	areAnySelected = () => {
		const { product } = this.props;
		const { variations } = this.state;
		return reduce(
			variations,
			( result, variation ) => {
				return result || this.isSelected( variation.id );
			},
			this.isSelected( product.id )
		);
	};

	renderSelectedVariations = () => {
		if ( ! this.state.variations.length ) {
			return null;
		}
		return this.state.variations.map( variation =>
			this.renderRow( { ...this.props.product, ...variation, isVariation: true } )
		);
	};

	renderVariations = () => {
		// None are selected, and we aren't showing the form
		if ( ! this.areAnySelected() && ! this.state.showForm ) {
			return null;
		}

		return (
			<div>
				{ this.renderSelectedVariations() }
				<ProductVariations product={ this.props.product } onChange={ this.updateItem } />
			</div>
		);
	};

	renderInputComponent = product => {
		const inputId = `product-search_select-${ product.id }`;
		const { singular } = this.props;
		const component = singular ? FormRadio : FormCheckbox;

		if ( 'variable' === product.type && ! product.isVariation ) {
			return <Count count={ this.state.variations.length } />;
		}

		return React.createElement( component, {
			id: inputId,
			name: inputId,
			value: product.id,
			checked: this.isSelected( product.id ),
			onChange: this.onChange,
		} );
	};

	renderInputName = product => {
		const { currency, translate } = this.props;
		const price = formatCurrency( product.price, currency );
		let nameWithPrice = `${ product.name } - ${ price }`;
		// Some things do need special handling…
		if ( product.isVariation ) {
			const varName = formattedVariationName( product );
			nameWithPrice = `${ product.name } - ${ varName } - ${ price }`;
		}
		if ( 'variable' === product.type && ! product.isVariation ) {
			return (
				<span>
					<span>{ nameWithPrice }</span>
					<Button compact onClick={ this.toggleCustomizeForm }>
						{ translate( 'Customize' ) }
					</Button>
				</span>
			);
		}
		return <span>{ nameWithPrice }</span>;
	};

	renderInputImage( product ) {
		let imageSrc = get( product, 'images[0].src', false );
		// Check for a variation image
		if ( product.isVariation ) {
			imageSrc = get( product.image, 'src', imageSrc );
		}
		const imageClasses = classNames( 'product-search__list-image', {
			'is-thumb-placeholder': ! imageSrc,
		} );

		return <span className={ imageClasses }>{ imageSrc && <img src={ imageSrc } /> }</span>;
	}

	renderRow = product => {
		const id = product.id;
		const inputId = `product-search_select-${ id }`;

		const labelProps = {};
		if ( 'variable' === product.type && ! product.isVariation ) {
			labelProps.onClick = this.toggleCustomizeForm;
		}

		return (
			<FormLabel htmlFor={ inputId } key={ id } { ...labelProps }>
				{ this.renderInputComponent( product ) }
				{ this.renderInputImage( product ) }
				{ this.renderInputName( product ) }
			</FormLabel>
		);
	};

	render() {
		return (
			<div className="product-search__row">
				{ this.renderRow( this.props.product ) }
				{ this.renderVariations() }
			</div>
		);
	}
}

export default connect(
	( state, props ) => {
		const site = getSelectedSiteWithFallback( state );
		const siteId = site ? site.ID : null;
		const productId = props.product.id;
		const variations = getVariationsForProduct( state, productId );
		const currencySettings = getPaymentCurrencySettings( state, siteId );
		const currency = currencySettings ? currencySettings.value : null;

		return {
			currency,
			siteId,
			productId,
			variations,
		};
	},
	dispatch => bindActionCreators( { fetchProductVariations }, dispatch )
)( localize( ProductSearchRow ) );
