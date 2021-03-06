/**
 * External dependencies
 *
 * @format
 */
import React from 'react';
import PropTypes from 'prop-types';
import identity from 'lodash/identity';
import noop from 'lodash/noop';
import { localize } from 'i18n-calypso';

/**
 * Internal dependencies
 */
import { Input } from 'my-sites/domains/components/form';

const EuAddressFieldset = props => {
	const { getFieldProps, translate } = props;
	return (
		<div className="domain-form-fieldsets__address-fields eu-address-fieldset">
			<Input label={ translate( 'Postal Code' ) } { ...getFieldProps( 'postal-code', true ) } />
			<Input label={ translate( 'City' ) } { ...getFieldProps( 'city', true ) } />
		</div>
	);
};

EuAddressFieldset.propTypes = {
	getFieldProps: PropTypes.func,
	translate: PropTypes.func,
};

EuAddressFieldset.defaultProps = {
	getFieldProps: noop,
	translate: identity,
};

export default localize( EuAddressFieldset );
