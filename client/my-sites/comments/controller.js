/** @format */
/**
 * External dependencies
 */
import { renderWithReduxStore } from 'lib/react-helpers';
import React from 'react';
import page from 'page';
import { each, isNaN, startsWith } from 'lodash';

/**
 * Internal dependencies
 */
import { isEnabled } from 'config';
import CommentsManagement from './main';
import CommentView from 'my-sites/comment/main';
import route, { addQueryArgs } from 'lib/route';
import {
	bumpStat,
	composeAnalytics,
	recordTracksEvent,
	withAnalytics,
} from 'state/analytics/actions';
import { changeCommentStatus, deleteComment } from 'state/comments/actions';
import { removeNotice } from 'state/notices/actions';
import { getNotices } from 'state/notices/selectors';

const mapPendingStatusToUnapproved = status => ( 'pending' === status ? 'unapproved' : status );

const sanitizeInt = number => {
	const integer = parseInt( number, 10 );
	return ! isNaN( integer ) && integer > 0 ? integer : false;
};

const changePage = path => pageNumber => {
	if ( window ) {
		window.scrollTo( 0, 0 );
	}
	return page( addQueryArgs( { page: pageNumber }, path ) );
};

export const siteComments = ( { params, path, query, store } ) => {
	const siteFragment = route.getSiteFragment( path );

	if ( ! siteFragment ) {
		return page.redirect( '/comments/all' );
	}

	const status = mapPendingStatusToUnapproved( params.status );

	const pageNumber = sanitizeInt( query.page );
	if ( ! pageNumber ) {
		return changePage( path )( 1 );
	}

	renderWithReduxStore(
		<CommentsManagement
			changePage={ changePage( path ) }
			page={ pageNumber }
			siteFragment={ siteFragment }
			status={ status }
		/>,
		'primary',
		store
	);
};

export const postComments = ( { params, path, query, store } ) => {
	const siteFragment = route.getSiteFragment( path );

	if ( ! siteFragment ) {
		return page.redirect( '/comments/all' );
	}

	const status = mapPendingStatusToUnapproved( params.status );
	const postId = sanitizeInt( params.post );

	if ( ! postId ) {
		return page.redirect( `/comments/${ params.status }/${ siteFragment }` );
	}

	const pageNumber = sanitizeInt( query.page );
	if ( ! pageNumber ) {
		return changePage( path )( 1 );
	}

	renderWithReduxStore(
		<CommentsManagement
			changePage={ changePage( path ) }
			page={ pageNumber }
			postId={ postId }
			siteFragment={ siteFragment }
			status={ status }
		/>,
		'primary',
		store
	);
};

const sanitizeQueryAction = action => {
	if ( ! action ) {
		return null;
	}

	const validActions = {
		approve: 'approved',
		trash: 'trash',
		spam: 'spam',
		delete: 'delete',
	};
	return validActions.hasOwnProperty( action.toLowerCase() )
		? validActions[ action.toLowerCase() ]
		: null;
};

const updateCommentStatus = ( siteId, postId, commentId, status ) =>
	withAnalytics(
		composeAnalytics(
			recordTracksEvent( 'calypso_comment_management_mail_change_status', {
				status,
			} ),
			bumpStat( 'calypso_comment_management_mail', 'comment_status_changed_to_' + status )
		),
		changeCommentStatus( siteId, postId, commentId, status )
	);

export const comment = ( { query, params, path, store } ) => {
	const siteFragment = route.getSiteFragment( path );
	const commentId = sanitizeInt( params.comment );

	if ( ! commentId || ! isEnabled( 'comments/management/m3-design' ) ) {
		return siteFragment
			? page.redirect( `/comments/all/${ siteFragment }` )
			: page.redirect( '/comments/all' );
	}

	const action = sanitizeQueryAction( query.action );
	const siteId = sanitizeInt( query.site_id );
	const postId = sanitizeInt( query.post_id );

	/* SECURITY WARNING
	 *
	 * we may not have user capabilities loaded onto state.
	 * We trust that the API will handle user capabilities for us.
	 */
	if ( action && siteId && postId ) {
		const { dispatch } = store;
		if ( 'delete' === action ) {
			dispatch( deleteComment( siteId, postId, commentId, { showSuccessNotice: true } ) );
		} else {
			dispatch( updateCommentStatus( siteId, postId, commentId, action ) );
		}
	}

	renderWithReduxStore(
		<CommentView { ...{ action, commentId, siteFragment } } />,
		'primary',
		store
	);
};

export const redirect = ( { path } ) => {
	const siteFragment = route.getSiteFragment( path );
	if ( siteFragment ) {
		return page.redirect( `/comments/all/${ siteFragment }` );
	}
	return page.redirect( '/comments/all' );
};

export const clearCommentNotices = ( { store }, next ) => {
	const nextPath = page.current;
	if ( ! startsWith( nextPath, '/comments' ) ) {
		const { getState, dispatch } = store;
		const notices = getNotices( getState() );
		each( notices, ( { noticeId } ) => {
			if ( startsWith( noticeId, 'comment-notice' ) ) {
				dispatch( removeNotice( noticeId ) );
			}
		} );
	}
	next();
};
