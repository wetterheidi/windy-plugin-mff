<div class="plugin__mobile-header">
    {title}
</div>
<section class="plugin__content">
    <div
        class="plugin__title plugin__title--chevron-back"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        {title} <span style="font-size: 0.5em;">v{version}</span>
    </div>

    {#if !ready}
        <h4><strong>Click on map to generate an upper wind table</strong></h4>
    {:else if errorHandlerOutput}
        <h4><strong>No forecast available for {forecastDateString}</strong></h4>
    {:else}
        <h4>
            <strong>Location: </strong><br />
            {clickLocation}
        </h4>
        <h4>
            <strong>Forecast time: </strong><br />
            {forecastDateString}
        </h4>
        <h4>
            <strong>Forecast model: </strong><br />
            {forecastModel}
        </h4>
        <h4>
            <strong>Elevation:</strong>
            {elevation}
        </h4>
        <hr />
        <h4><strong>Upper winds, temperature and humidity</strong></h4>
        <div class="weather-stats">
            <table>
                <thead>
                    <tr>
                        <th>h</th>
                        <th>Dir</th>
                        <th>Speed</th>
                        <th>p</th>
                        <th>T</th>
                        <th>Td</th>
                        <th>RHw</th>
                    </tr>
                    <tr>
                        <th>{altitudeUnit} <br />{settings.referenceLevel}</th>
                        <th>°</th>
                        <th>{windUnit}</th>
                        <th>hPa</th>
                        <th>{temperatureUnit}</th>
                        <th>{temperatureUnit}</th>
                        <th>%</th>
                    </tr>
                </thead>
            </table>
        </div>
        <div class="weather-stats">
            <table>
                <tbody class="scroll">
                    {#each flightLevels as { heightAGL, height, windDir, windSp, pressure, temperature, humidityWater, dewPointt }}
                        <tr
                            class:green-text={temperature > freezingLevelAt - 0.5 &&
                                temperature < freezingLevelAt + 0.5}
                            class:blue-text={temperature <= freezingLevelAt - 0.5}
                            class:red-text={temperature >= freezingLevelAt + 0.5}
                        >
                            {#if settings.referenceLevel == 'AGL'}
                                <td>{heightAGL}</td>
                            {:else}
                                <td>{height}</td>
                            {/if}
                            <td>{windDir}</td>
                            <td>{windSp}</td>
                            <td>{pressure}</td>
                            <td>{temperature}</td>
                            <td>{dewPointt}</td>
                            <td>{humidityWater}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        <hr />
        <div>
            <h4>
                <strong>Settings: </strong><br />
                <h4>
                    <div class="mb-3">
                        <label for="" class="form-label">Choose interpolation step: </label>
                        <select bind:value={settings.increment} class="from-select">
                            <option value="" disabled>-- Select Increment --</option>
                            {#each incrementquestions as incrementquestion}
                                <option value={incrementquestion.text}
                                    >{incrementquestion.text}</option
                                >
                            {/each}
                        </select>
                        <label for="" class="form-label">{altitudeUnit} </label>
                    </div>
                    <div class="mb-3">
                        <label for="" class="form-label"
                            >Choose reference level for altitude:
                        </label>
                        <select bind:value={settings.referenceLevel} class="from-select">
                            <option value="" disabled>-- Select Reference --</option>
                            {#each referencelevelquestions as referencelevelquestions}
                                <option value={referencelevelquestions.text}
                                    >{referencelevelquestions.text}</option
                                >
                            {/each}
                        </select>
                    </div>
                </h4>
            </h4>
        </div>
        <hr />
        <div>
            <h4>
                <strong>Calculate mean wind between: </strong><br />
                <h4>
                    <div class="mb-3">
                        <label for="" class="form-label">Lower altitude: </label>
                        <input type="text" bind:value={lowerAltitudeInput} />
                        <label for="" class="form-label"
                            >{altitudeUnit} {settings.referenceLevel}</label
                        >
                    </div>
                    <div class="mb-3">
                        <label for="" class="form-label">Upper altitude: </label>
                        <input type="text" bind:value={upperAltitudeInput} />
                        <label for="" class="form-label"
                            >{altitudeUnit} {settings.referenceLevel}</label
                        >
                    </div>
                </h4>
                <div class="mb-3">
                    <strong>Mean wind: {meanWindDirection}° {meanWindSpeed} {windUnit}</strong>
                </div>
            </h4>
        </div>
        <hr />
        <div style="text-align:center">
            <button on:click={() => downloadData(Format.FMT_CSV)}> Download CSV </button>
            <button on:click={() => downloadData(Format.FMT_JSON)}> Download JSON </button>
            <h4></h4>
            <button on:click={() => downloadData(Format.FMT_HEIDIS)}> Download HEIDIS </button>
            <button on:click={() => downloadData(Format.FMT_ATAK)}> Download ATAK </button>
        </div>
    {/if}
    <hr />
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { map } from '@windy/map';
    import { onDestroy, onMount } from 'svelte';
    import config from './pluginConfig';
    import { singleclick } from '@windy/singleclick';
    import { UpperWind } from './classes/UpperWind.class';
    import windyStore from '@windy/store';
    import { LatLon } from '@windycom/plugin-devtools/types/interfaces';
    import { Utility } from './classes/Utility.class';

    let ready = false;
    let flightLevels: any[] = [];
    let clickLocation = '';
    let filteredFlightLevels: any[] = [];
    let forecastDate: any = '';
    let forecastDateString: string = '';
    let forecastModel = '';
    let elevation: any;
    let position: LatLon | undefined = undefined;
    let meanWindDirection: number;
    let meanWindSpeed: number;
    let destroyed: boolean = false;

    const { title } = config;
    const { version } = config;
    const upperwind = new UpperWind();

    /* Take user settings for Table*/
    /* Settings for temperature*/
    let temperatureUnit: string = Utility.findOutTemperatureUnit(273.15);
    let freezingLevelAt: number = 0;
    function freezingLevel() {
        if (temperatureUnit === '°C') {
            freezingLevelAt = 0;
        } else if (temperatureUnit === '°F') {
            freezingLevelAt = 32;
        }
        return freezingLevelAt;
    }
    freezingLevelAt = freezingLevel();

    /* Settings for wind*/
    let windUnit: string = Utility.findOutWindUnit(10);
    let altitudeUnit: string = Utility.findOutAltitudeUnit(100);
    let settings = {
        increment: '500',
        referenceLevel: 'AGL',
    };
    let incrementquestions = [
        { text: '100' },
        { text: '200' },
        { text: '500' },
        { text: '1000' },
        { text: '2000' },
    ];
    let referencelevelquestions = [{ text: 'AGL' }, { text: 'AMSL' }];
    let lowerAltitudeInput: string = '0';
    let upperAltitudeInput: string = '3000';
    let errorHandlerOutput: boolean = false;

    //On settings changed, recalculate upper winds table
    $: {
        upperwind._lowerLevel = lowerAltitudeInput;
        upperwind._upperLevel = upperAltitudeInput;
        errorHandlerOutput = false;
        errorHandlerOutput = upperwind._errorhandler;
        console.log('Errorhandler: ' + errorHandlerOutput);

        const heightAGLArray = flightLevels.map(row => row.heightAGL);
        const heightMSLArray = flightLevels.map(row => row.height);
        const wind_uArray = flightLevels.map(row => row.wind_u);
        const wind_vArray = flightLevels.map(row => row.wind_v);

        if (settings.referenceLevel == 'AGL') {
            meanWindDirection = Utility.Mittelwind(
                heightAGLArray,
                wind_uArray,
                wind_vArray,
                Number(upperwind._lowerLevel),
                Number(upperwind._upperLevel),
            )[0];
            meanWindSpeed = Utility.Mittelwind(
                heightAGLArray,
                wind_uArray,
                wind_vArray,
                Number(upperwind._lowerLevel),
                Number(upperwind._upperLevel),
            )[1];
        } else if (settings.referenceLevel == 'AMSL') {
            meanWindDirection = Utility.Mittelwind(
                heightMSLArray,
                wind_uArray,
                wind_vArray,
                Number(upperwind._lowerLevel),
                Number(upperwind._upperLevel),
            )[0];
            meanWindSpeed = Utility.Mittelwind(
                heightMSLArray,
                wind_uArray,
                wind_vArray,
                Number(upperwind._lowerLevel),
                Number(upperwind._upperLevel),
            )[1];
        }

        upperwind._step = Number(settings.increment);
        upperwind._reference = settings.referenceLevel;
        const fl = upperwind.restratify();
        if (fl) {
            flightLevels = fl;
        }
    }

    /* Add layer for lines to the map*/
    var activeLayer = L.featureGroup().addTo(map);
    var popup = L.popup({ autoClose: false, closeOnClick: false, closeButton: false });

    // Make the popup draggable
    let draggablePopup: any;
    async function makePopupDraggable() {
        if (!draggablePopup) {
            draggablePopup = new L.Draggable(popup._container, popup._wrapper);
            draggablePopup.enable();

            // Update position and fetch new data when dragging ends
            draggablePopup.on('dragend', async function () {
                const containerPoint = map.layerPointToContainerPoint(draggablePopup._newPos);
                const latlng = map.containerPointToLatLng(containerPoint);
                popup.setLatLng(latlng); // Update popup position
                position = { lat: latlng.lat, lon: latlng.lng }; // Update position variable

                // Show loading state
                popup.setContent('Loading....');

                // Fetch new weather data for the updated position
                upperwind.setTime(windyStore.get('timestamp'));
                await upperwind.handleEvent(position); // Fetch new data
                assignAnalysis(upperwind); // Update UI with new data
                popup.setContent(clickLocation); // Update popup content
            });
        }
    }

    activeLayer.clearLayers();

    export const onopen = async (_params: { lat: any; lon: any }) => {
        if (!_params) {
            return;
        }
        destroyed = false;
        bcast.on('pluginOpened', async () => {
            console.log('In onopen pluginOpened ');
            if (destroyed == true) return;
            Utility.checkOverlay();
            popup
                .setLatLng([_params.lat, _params.lon])
                .setContent('Loading....')
                .addTo(activeLayer)
                .openOn(map);
            makePopupDraggable(); // Enable dragging
            upperwind.setTime(windyStore.get('timestamp'));
            await upperwind.handleEvent(_params);
            assignAnalysis(upperwind);
            popup.setContent(clickLocation);
            map.setView(new L.LatLng(_params.lat, _params.lon), 11);
        });
    };

    onMount(() => {
        if (destroyed == true) return;
        singleclick.on('windy-plugin-mff', async ev => {
            console.log('In onMount singleclick');
            if (destroyed == false) {
                Utility.checkOverlay();
            }
            position = { lat: ev.lat, lon: ev.lon };
            popup
                .setLatLng([position.lat, position.lon])
                .setContent('Loading....')
                .addTo(activeLayer)
                .openOn(map);
            makePopupDraggable(); // Enable dragging
            await upperwind.handleEvent(ev);
            assignAnalysis(upperwind);
            popup.setContent(clickLocation);
            map.setView(new L.LatLng(position.lat, position.lon), 11);
        });

        bcast.on('pluginOpened', async () => {
            if (position === undefined) return;
            upperwind.setTime(windyStore.get('timestamp'));
            popup
                .setLatLng([position.lat, position.lon])
                .setContent('Loading....')
                .addTo(activeLayer)
                .openOn(map);
            makePopupDraggable(); // Enable dragging
            await upperwind.handleEvent(position);
            assignAnalysis(upperwind);
            popup.setContent(clickLocation);
        });

        // Handle timestamp or model changes
        bcast.on('paramsChanged', async () => {
            console.log('In onMount paramsChanged');
            if (destroyed == false) {
                Utility.checkOverlay();
            }
            if (position === undefined) return;

            // Update timestamp and re-fetch data (model handled internally by handleEvent)
            upperwind.setTime(windyStore.get('timestamp'));
            popup.setContent('Loading....');
            await upperwind.handleEvent(position); // Re-fetch data with current model and timestamp
            assignAnalysis(upperwind);
            popup.setContent(clickLocation);
        });

        bcast.on('pluginClosed', async () => {
            popup.closePopup();
        });
    });

    onDestroy(() => {
        destroyed = true;
        console.log('Im onDestroy');
        popup.remove();
        if (draggablePopup) {
            draggablePopup.disable();
            draggablePopup.off('dragend');
        }
        bcast.off('paramsChanged', onMount);
        bcast.off('pluginOpened', onMount);
        bcast.off('pluginClosed', onMount);
        singleclick.emit(' windy-plugin-mff', 'destroy');
        map.removeControl(bcast);
        windyStore.off('timestamp', upperwind.setTime);
        windyStore.off('overlay', Utility.checkOverlay);
        windyStore.off('product', upperwind.handleEvent);
    });

  /* Assigns the Analysis to a location and a model*/
   function assignAnalysis(upperwind: UpperWind) {
        temperatureUnit = Utility.findOutTemperatureUnit(0);
        altitudeUnit = Utility.findOutAltitudeUnit(1000);
        windUnit = Utility.findOutWindUnit(10);
        freezingLevelAt = freezingLevel();

        clickLocation = upperwind.clickLocation;
        flightLevels = upperwind.flightLevels;
        filteredFlightLevels = flightLevels.filter(
            level => level.temperature <= level.applemanTemp,
        );

        forecastDate = new Date(windyStore.get('timestamp'));
        let year = forecastDate.getFullYear();
        let month = forecastDate.getMonth() + 1;
        let day = forecastDate.getDate();
        let hours = forecastDate.getHours();
        forecastDateString = year + '-' + month + '-' + day + ' ' + hours + ':00 loc ';
        forecastModel = upperwind.model;
        elevation =
            (upperwind.elevation * 3.28084).toFixed(0) + ' ft/ ' + upperwind.elevation + ' m';
        ready = true;
    }

    /** Download the Data  */
    // https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser
    // "ES6+ version for 2021; no 1MB limit either:"
    const saveTemplateAsFile = (filename: string, blob: Blob, mimeType: string) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = window.URL.createObjectURL(blob);
        link.dataset.downloadurl = [mimeType, link.download, link.href].join(':');

        const evt = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
        });

        link.dispatchEvent(evt);
        link.remove();
    };

    function downloadData(format: any) {
        if (format === Format.FMT_CSV) {
            const csvConfig = mkConfig({
                useKeysAsHeaders: true,
            });
            const csv = generateCsv(csvConfig)(flightLevels);
            const blob = asBlob(csvConfig)(csv);
            saveTemplateAsFile(
                forecastDateString + '_' + forecastModel + '.csv',
                blob,
                'text/csv;charset=utf-8',
            );
        }
        if (format === Format.FMT_JSON) {
            const data = JSON.stringify(flightLevels, undefined, 2);
            const blob = new Blob([data], { type: 'text/json' });
            saveTemplateAsFile(
                forecastDateString + '_' + forecastModel + '.json',
                blob,
                'text/json',
            );
        }
        if (format === Format.FMT_HEIDIS) {
            // which keys to extract into columns, by field order

            const sequence = [
                { key: 'pressure', header: 'p', unit: 'hPa' },
                { key: 'height', header: 'hAMSL', unit: altitudeUnit },
                { key: 'heightAGL', header: 'hAGL', unit: altitudeUnit },
                { key: 'temperature', header: 'T', unit: temperatureUnit },
                { key: 'dewPointt', header: 'Td', unit: temperatureUnit },
                { key: 'wind_u', header: 'u', unit: 'm/s' },
                { key: 'wind_v', header: 'v', unit: 'm/s' },
                { key: 'windDir', header: 'Dir', unit: 'deg' },
                { key: 'windSp', header: 'Spd', unit: windUnit },
            ];

            const lineSeparator = `\n`;
            const fieldSeparator = ' ';
            const rowConverter = (row: any) => {
                return sequence
                    .map(field => `${row[field.key]}` + fieldSeparator)
                    .join('')
                    .slice(0, -1);
            };

            const data = flightLevels.map(rowConverter).join(lineSeparator);
            const columnNames =
                sequence
                    .map(fd => fd.header + fieldSeparator)
                    .join('')
                    .slice(0, -1) + lineSeparator;
            const units =
                sequence
                    .map(fd => fd.unit + fieldSeparator)
                    .join('')
                    .slice(0, -1) + lineSeparator;

            const blob = new Blob([columnNames + units + data], {
                type: 'text/plain',
            });
            saveTemplateAsFile(
                forecastDateString + '_' + forecastModel + '_HEIDIS.txt',
                blob,
                'text/plain',
            );
        }
        if (format === Format.FMT_ATAK) {
            // which keys to extract into columns, by field order

            if (
                altitudeUnit == 'm' ||
                settings.referenceLevel == 'AMSL' ||
                settings.increment != '1000'
            ) {
                alert(
                    'You have to change altitude unit to feet,\n the reference level to AGL and \n the interpolation step to 1000 \n before downloading ATAK files!',
                );
                return;
            }

            const sequence = [
                { key: 'heightAGL', header: 'Alt', unit: altitudeUnit + 'AGL' },
                { key: 'windDir', header: 'Dir', unit: '' },
                { key: 'windSp', header: 'Spd', unit: '' },
            ];

            const lineSeparator = `\n`;
            const fieldSeparator = '\t';
            const rowConverter = (row: any) => {
                return sequence
                    .map(field => `${row[field.key]}` + fieldSeparator)
                    .join('')
                    .slice(0, -1);
            };

            const data = flightLevels.slice().reverse().map(rowConverter).join(lineSeparator);
            const columnNames =
                sequence
                    .map(fd => fd.header + fieldSeparator)
                    .join('')
                    .slice(0, -1) + lineSeparator;
            const units =
                sequence
                    .map(fd => fd.unit + fieldSeparator)
                    .join('')
                    .slice(0, -1) + lineSeparator;

            const blob = new Blob([columnNames + units + data], {
                type: 'text/plain',
            });
            saveTemplateAsFile(
                forecastDateString + '_' + forecastModel + '_ATAK.txt',
                blob,
                'text/plain',
            );
        }
    }
</script>

<style lang="less">
    .weather-stats {
        display: flex;
        flex-direction: column;
        padding: 10px;
        background-color: #f8f8f8;
        text-align: center;
        max-height: 520px;
        overflow: auto;
        th {
            color: black; /* Sets the text color of headers to black */
            background-color: #e5e5e5; /* Optional: sets a light gray background for better contrast */
        }
        td {
            text-align: right;
            width: 14.28%; // make all columns the same width
        }
        label {
            font-weight: bold;
        }
        .stat {
            margin-bottom: 5px;
        }
        table {
            width: 100%; // Ensures the table takes the full width of its container
        }

        .green-text {
            color: #026f00;
        } /* Dark green */
        .yellow-text {
            color: #daa520;
        }
        .red-text {
            color: #c42f2f;
        } /* Firebrick red */
        .blue-text {
            color: blue;
        }
        .black-text {
            color: black;
        }
    }

    select {
        background-color: #6b6b6b;
        border: none;
        padding: 0 1em 0 0;
        margin: 0;
        width: 80px;
        color: #ffe3a1;
        border-radius: 3px;
    }

    input {
        background-color: #6b6b6b;
        border: none;
        padding: 0 1em 0 0;
        margin: 0;
        width: 80px;
        color: #ffe3a1;
        border-radius: 3px;
    }

    button {
        background-color: #6b6b6b;
        border: none;
        color: #ffe3a1;
        text-align: center;
        text-decoration: none;
        border-radius: 3px;
    }

    .nav-links {
        list-style-type: none;
        padding: 0;
        margin: 0;
        background-color: #f8f9fa;
        padding: 10px;
        border-radius: 5px;
    }

    .nav-links li {
        margin-bottom: 10px;
    }

    .nav-links li:last-child {
        margin-bottom: 0;
    }

    .nav-links a {
        text-decoration: none;
        color: #007bff;
        font-weight: bold;
    }

    .nav-links a:hover {
        text-decoration: underline;
    }

    /* css to customize Leaflet default styles  */
    .popupCustom .leaflet-popup-tip,
    .popupCustom .leaflet-popup-content-wrapper {
        background: #e0e0e0;
        color: #234c5e;
    }
</style>
