import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import i18n, { changeLanguage } from 'i18next';
import PropTypes from 'prop-types';
import React from 'react';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Stack from 'react-bootstrap/Stack';
import { withTranslation } from 'react-i18next';

import PdfWorker from './worker/pdf.worker.js'; // eslint-disable-line import/default

import PdfPreview from 'components/pdf-preview';
import Itinerary, {
	ITINERARY_ITEM,
	ITINERARY_LINES,
} from 'configuration-form/itinerary';
import ToggleForm from 'configuration-form/toggle-form';
import { getWeekdays } from 'lib/date';
import PdfConfig from 'pdf/config';
import RecalendarPdf from 'pdf/recalendar';

import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

class App extends React.PureComponent {
	state = {
		isGeneratingPdf: false,
		isGeneratingPreview: false,
		language: i18n.language,
		blobUrl: null,
		year: this.props.initialState.year,
		month: this.props.initialState.month,
		monthCount: this.props.initialState.monthCount,
		isMonthOverviewEnabled: this.props.initialState.isMonthOverviewEnabled,
		monthItinerary: this.props.initialState.monthItinerary,
		dayItineraries: this.props.initialState.dayItineraries,
	};

	constructor( props ) {
		super( props );

		this.pdfWorker = new PdfWorker();
		this.pdfWorker.onmessage = this.handlePdfWorkerMessage;
	}

	componentDidMount() {
		i18n.on( 'languageChanged', this.handleLanguageChange );
	}

	componentWillUnmount() {
		i18n.off( 'languageChanged', this.handleLanguageChange );
	}

	componentDidUpdate( prevProps, prevState ) {
		if ( prevState.blobUrl && prevState.blobUrl !== this.state.blobUrl ) {
			// Each refresh generates a new blob - and it will be kept in the memory
			// until the window is refreshed/unloaded. To keep memory consumption low
			// lets explicitly release the stale blob.
			// See https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
			URL.revokeObjectURL( prevState.blobUrl );
		}
	}

	handleLanguageSelection = ( event ) => {
		const newLanguage = event.target.value;
		changeLanguage( newLanguage );
	};

	handleLanguageChange = ( newLanguage ) => {
		this.setState( { language: newLanguage } );
	};

	handleYearChange = ( event ) => {
		this.setState( { year: event.target.value } );
	};

	handleMonthChange = ( event ) => {
		this.setState( { month: event.target.value } );
	};

	handleMonthCountChange = ( event ) => {
		this.setState( { monthCount: event.target.value } );
	};

	handleDownload = ( event ) => {
		this.setState( { isGeneratingPdf: true } );
		this.generatePdf( false );
	};

	handlePreview = ( event ) => {
		event.preventDefault();
		this.setState( { isGeneratingPreview: true } );
		this.generatePdf( true );
	};

	generatePdf( isPreview ) {
		this.pdfWorker.postMessage( {
			isPreview,
			year: this.state.year,
			month: this.state.month,
			monthCount: this.state.monthCount,
			isMonthOverviewEnabled: this.state.isMonthOverviewEnabled,
			monthItinerary: this.state.monthItinerary,
			dayItineraries: this.state.dayItineraries,
			language: this.state.language,
		} );
	}

	handlePdfWorkerMessage = ( { data: { blob } } ) => {
		const shouldTriggerDownload = this.state.isGeneratingPdf;
		if ( this.state.isGeneratingPreview ) {
			this.setState( { blobUrl: URL.createObjectURL( blob ) } );
		}
		this.setState( { isGeneratingPdf: false, isGeneratingPreview: false } );
		if ( shouldTriggerDownload ) {
			saveAs( blob, 'recalendar.pdf' );
		}
	};

	handlePdfGeneration = ( { blob, url, loading, error } ) => {
		const { t } = this.props;
		return loading ? t( 'loading' ) : t( 'download-ready' );
	};

	handleMonthItineraryChange = ( name, type, index, value ) => {
		const newItinerary = [ ...this.state.monthItinerary ];
		newItinerary[ index ] = {
			type,
			value,
		};
		this.setState( { monthItinerary: newItinerary } );
	};

	handleMonthItineraryRemove = ( name, index ) => {
		const newItinerary = [ ...this.state.monthItinerary ];
		newItinerary.splice( index, 1 );
		this.setState( { monthItinerary: newItinerary } );
	};

	handleMonthItineraryAdd = ( name, type ) => {
		const newItinerary = [ ...this.state.monthItinerary ];
		newItinerary.push( {
			type,
			value: '',
		} );
		this.setState( { monthItinerary: newItinerary } );
	};

	handleMonthOverviewToggle = ( event ) => {
		this.setState( { isMonthOverviewEnabled: event.target.checked } );
	};

	handleDayItineraryChange = ( name, type, index, value ) => {
		const newItineraries = [ ...this.state.dayItineraries ];
		newItineraries[ name ][ index ] = {
			type,
			value,
		};
		this.setState( { dayItineraries: newItineraries } );
	};

	handleDayItineraryRemove = ( name, index ) => {
		const newItineraries = [ ...this.state.dayItineraries ];
		newItineraries[ name ].splice( index, 1 );
		this.setState( { dayItineraries: newItineraries } );
	};

	handleDayItineraryAdd = ( name, type ) => {
		const newItineraries = [ ...this.state.dayItineraries ];
		newItineraries[ name ].push( {
			type,
			value: '',
		} );
		this.setState( { dayItineraries: newItineraries } );
	};

	renderMonths() {
		return dayjs
			.localeData()
			.months()
			.map( ( month, index ) => (
				<option key={ index } value={ index }>
					{month}
				</option>
			) );
	}

	renderDayItineraries() {
		return (
			<Card className="mt-3">
				<Card.Header>Day itineraries</Card.Header>
				<Card.Body>{getWeekdays().map( this.renderDayItinerary )}</Card.Body>
			</Card>
		);
	}

	renderDayItinerary = ( { full: dayOfWeek }, index ) => {
		return (
			<Itinerary
				key={ dayOfWeek }
				name={ index.toString() }
				title={ dayOfWeek }
				itinerary={ this.state.dayItineraries[ index ] }
				onAdd={ this.handleDayItineraryAdd }
				onChange={ this.handleDayItineraryChange }
				onRemove={ this.handleDayItineraryRemove }
			/>
		);
	};

	renderConfigurationForm() {
		const { t } = this.props;
		const { isGeneratingPdf, isGeneratingPreview } = this.state;
		return (
			<Card className="my-3">
				<Card.Header>ReCalendar</Card.Header>
				<Card.Body>
					<Form onSubmit={ this.handlePreview }>
						<Form.Label htmlFor="languagePicker">
							{t( 'configuration.language.label' )}
						</Form.Label>
						<Form.Select
							value={ this.state.language }
							onChange={ this.handleLanguageSelection }
						>
							<option value="en">{t( 'configuration.language.english' )}</option>
							<option value="pl">{t( 'configuration.language.polish' )}</option>
						</Form.Select>
						<Form.Group controlId="year">
							<Form.Label>{t( 'configuration.year' )}</Form.Label>
							<Form.Control
								type="number"
								value={ this.state.year }
								onChange={ this.handleYearChange }
							/>
						</Form.Group>
						<Form.Group controlId="month">
							<Form.Label>{t( 'configuration.starting-month' )}</Form.Label>
							<Form.Select
								value={ this.state.month }
								onChange={ this.handleMonthChange }
							>
								{this.renderMonths()}
							</Form.Select>
							<Form.Text className="text-muted">
								The first month in the generated calendar. Choose something like
								October if you want your calendar to cover a semester, instead
								of a calendar year.
							</Form.Text>
						</Form.Group>
						<Form.Group controlId="monthCount">
							<Form.Label>{t( 'configuration.month-count' )}</Form.Label>
							<Form.Control
								type="number"
								value={ this.state.monthCount }
								onChange={ this.handleMonthCountChange }
								min={ 1 }
								max={ 12 }
							/>
							<Form.Text className="text-muted">
								For how many months should the calendar be generated for.
							</Form.Text>
						</Form.Group>
						<ToggleForm
							title="Month overview"
							onToggle={ this.handleMonthOverviewToggle }
							toggledOn={ this.state.isMonthOverviewEnabled }
						>
							<p>Month overview prepares you for the month. Bla bla bla.</p>
							<Itinerary
								name="monthItinerary"
								title={ t( 'configuration.month.itinerary.title' ) }
								itinerary={ this.state.monthItinerary }
								onAdd={ this.handleMonthItineraryAdd }
								onChange={ this.handleMonthItineraryChange }
								onRemove={ this.handleMonthItineraryRemove }
							/>
						</ToggleForm>
						{this.renderDayItineraries()}
						<Button
							variant="primary"
							className="mt-3 w-100"
							disabled={ isGeneratingPreview || isGeneratingPdf }
							type="submit"
						>
							{isGeneratingPreview ? (
								<>
									<Spinner
										as="span"
										animation="border"
										size="sm"
										role="status"
										aria-hidden="true"
										className="me-1"
									/>
									{t( 'configuration.button.generating' )}
								</>
							) : (
								t( 'configuration.button.refresh' )
							)}
						</Button>
						<Form.Text className="text-muted">
							PDF generation is done entirely in your browser - no data is sent
							to our servers!
						</Form.Text>
					</Form>
				</Card.Body>
			</Card>
		);
	}

	renderPdfPreview() {
		const { t } = this.props;
		const { isGeneratingPdf, isGeneratingPreview, blobUrl } = this.state;
		return (
			<Stack direction="vertical" gap={ 3 } className="h-100">
				<PdfPreview
					blobUrl={ blobUrl }
					title={ t( 'configuration.preview.viewer-title' ) }
				/>
				<Button
					variant="secondary"
					disabled={ isGeneratingPreview || isGeneratingPdf }
					onClick={ this.handleDownload }
				>
					{isGeneratingPdf ? (
						<>
							<Spinner
								as="span"
								animation="border"
								size="sm"
								role="status"
								aria-hidden="true"
								className="me-1"
							/>
							Generating full calendar - this could take a minute or more...
						</>
					) : (
						t( 'configuration.button.download' )
					)}
				</Button>
			</Stack>
		);
	}

	renderNoPreview() {
		if ( this.state.isGeneratingPreview ) {
			return (
				<div className="h-100 d-flex align-items-center justify-content-center">
					<Spinner
						animation="border"
						role="status"
						size="sm"
						className="me-1"
					/>
					Generating preview, please wait - it can take a minute.
				</div>
			);
		}
		return (
			<Stack
				direction="vertical"
				className="h-100 d-flex align-items-center justify-content-center"
			>
				<p className="lead">
					Use the configuration form to create your personalized calendar.
				</p>
				<p>The preview will appear here.</p>
			</Stack>
		);
	}

	render() {
		const { config, blobUrl, isGeneratingPreview } = this.state;

		return (
			<Container className="h-100" fluid>
				<Row className="h-100">
					<Col className="h-100 overflow-auto">
						{this.renderConfigurationForm()}
					</Col>
					<Col className="py-3 h-100">
						<Card className="h-100">
							<Card.Header>
								Calendar preview (only first month is rendered)
							</Card.Header>
							<Card.Body>
								{blobUrl && ! isGeneratingPreview
									? this.renderPdfPreview()
									: this.renderNoPreview()}
							</Card.Body>
						</Card>
					</Col>
				</Row>
			</Container>
		);
	}
}

App.propTypes = {
	initialState: PropTypes.instanceOf( PdfConfig ).isRequired,
	t: PropTypes.func.isRequired,
};

export default withTranslation( [ 'app' ] )( App );