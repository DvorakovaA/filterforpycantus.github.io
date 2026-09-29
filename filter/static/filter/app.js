(function () {
  'use strict';

  const INCLUDE_KEYS = [
    'genre_incl', 'title_incl', 'office_incl', 'siglum_incl', 'feast_incl',
    'century_incl', 'db_incl', 'num_century_incl', 'provenance_incl', 'cursus_incl',
    'order_incl', 'not_before_incl', 'not_after_incl', 'type_incl'
  ];
  const EXCLUDE_KEYS = [
    'genre_excl', 'title_excl', 'office_excl', 'siglum_excl', 'feast_excl',
    'century_excl', 'db_excl', 'num_century_excl', 'provenance_excl', 'cursus_excl',
    'order_excl', 'not_before_excl', 'not_after_excl', 'type_excl'
  ];

  const TRANSLATE_KEY = {
    genre_incl: 'genre', office_incl: 'office', feast_incl: 'feast', db_incl: 'db',
    siglum_incl: 'siglum', title_incl: 'title', provenance_incl: 'provenance',
    century_incl: 'century', num_century_incl: 'num_century', cursus_incl: 'cursus',
    order_incl: 'order', not_before_incl: 'not_before', not_after_incl: 'not_after', type_incl: 'type',
    genre_excl: 'genre', office_excl: 'office', feast_excl: 'feast', db_excl: 'db',
    siglum_excl: 'siglum', title_excl: 'title', provenance_excl: 'provenance',
    century_excl: 'century', num_century_excl: 'num_century', cursus_excl: 'cursus',
    order_excl: 'order', not_before_excl: 'not_before', not_after_excl: 'not_after', type_excl: 'type'
  };

  const FIELD_SPECS = [
    { id: 'genre', label: 'Genre', source: 'genre', column: 'name', helpId: 'genre' },
    { id: 'title', label: 'Title', source: 'sources', column: 'title', helpId: 'title' },
    { id: 'office', label: 'Office', source: 'office', column: 'name', helpId: 'office' },
    { id: 'siglum', label: 'Siglum', source: 'sources', column: 'siglum', helpId: 'siglum' },
    { id: 'feast', label: 'Feast', source: 'feast', column: 'name', helpId: 'feast' },
    { id: 'century', label: 'Century', source: 'sources', column: 'century', helpId: 'century' },
    { id: 'db', label: 'Source Database', source: 'db', column: 'shortcut', helpId: 'db' },
    { id: 'num_century', label: 'Numerical Century', source: 'sources', column: 'num_century', helpId: 'num_century' },
    { id: 'provenance', label: 'Provenance', source: 'sources', column: 'provenance', helpId: 'provenance' },
    { id: 'cursus', label: 'Cursus', source: 'sources', column: 'cursus', helpId: 'cursus' },
    { id: 'order', label: 'Order', source: 'sources', column: 'order', helpId: 'order' },
    { id: 'not_before', label: 'Not before', source: 'sources', column: 'not_before', helpId: 'not_before' },
    { id: 'not_after', label: 'Not after', source: 'sources', column: 'not_after', helpId: 'not_after' },
    { id: 'type', label: 'Type', source: 'sources', column: 'type', helpId: 'type' },
  ];
  const INTEGER_ONLY_FIELDS = new Set(['num_century', 'not_before', 'not_after']);

  function getStaticBaseUrl() {
    const scripts = document.querySelectorAll('script[src]');
    const appScript = Array.from(scripts).find((s) => s.src.includes('/filter/static/filter/app.js') || s.src.endsWith('filter/static/filter/app.js'));
    if (appScript) {
      return new URL('.', appScript.src);
    }
    return new URL('filter/static/filter/', window.location.href);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        row.push(value);
        if (row.some((cell) => cell.trim() !== '')) rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    }

    return rows;
  }

  function toUniqueSortedChoices(values) {
    const unique = Array.from(new Set(values.map((v) => (v || '').trim()).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }

  function csvRowsToChoices(rows, columnName) {
    const header = rows[0] || [];
    const index = header.indexOf(columnName);
    if (index < 0) return [];
    const values = rows.slice(1).map((row) => row[index] || '');
    return toUniqueSortedChoices(values);
  }

  async function loadChoices() {
    const baseUrl = getStaticBaseUrl();
    const requiredFiles = [...new Set(FIELD_SPECS.map((f) => f.source))];
    const fileRows = {};

    await Promise.all(requiredFiles.map(async (file) => {
      const response = await fetch(new URL(`${file}.csv`, baseUrl).toString());
      if (!response.ok) {
        throw new Error(`Could not load ${file}.csv`);
      }
      const text = await response.text();
      fileRows[file] = parseCsv(text);
    }));

    const choices = {};
    FIELD_SPECS.forEach((field) => {
      choices[field.id] = csvRowsToChoices(fileRows[field.source], field.column);
    });

    return choices;
  }

  function createOption(value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  function createRepeatableField(container, key, options, fieldId) {
    let index = 0;
    const isIntegerOnlyField = INTEGER_ONLY_FIELDS.has(fieldId);

    function addRow() {
      const row = document.createElement('div');
      row.className = 'mb-2';

      const currentIndex = index;

      if (isIntegerOnlyField) {
        const integerInput = document.createElement('input');
        integerInput.type = 'number';
        integerInput.step = '1';
        integerInput.name = `${key}_${index}`;
        integerInput.id = `id_${key}_${index}`;
        integerInput.className = 'form-control';
        integerInput.placeholder = 'Enter integer...';

        integerInput.addEventListener('input', function () {
          const hasNext = container.querySelector(`[name="${key}_${currentIndex + 1}"]`);
          if (!hasNext && integerInput.value.trim() !== '') {
            index += 1;
            addRow();
          }
        });

        row.appendChild(integerInput);
      } else {
        const select = document.createElement('select');
        select.className = 'form-control';
        select.name = `${key}_${index}`;
        select.id = `id_${key}_${index}`;
        select.appendChild(createOption('', '-- Select --'));
        options.forEach((value) => {
          select.appendChild(createOption(value, value));
        });
        select.appendChild(createOption('other', 'Other'));

        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.name = `${key}_other_${index}`;
        customInput.id = `id_${key}_other_${index}`;
        customInput.className = 'form-control mt-2';
        customInput.placeholder = 'Enter custom...';
        customInput.style.display = 'none';

        select.addEventListener('change', function () {
          if (select.value === 'other') {
            customInput.style.display = 'block';
          } else {
            customInput.style.display = 'none';
          }

          const hasNext = container.querySelector(`select[name="${key}_${currentIndex + 1}"]`);
          if (!hasNext && select.value) {
            index += 1;
            addRow();
          }
        });

        row.appendChild(select);
        row.appendChild(customInput);
      }

      container.appendChild(row);
    }

    addRow();
  }

  function buildFieldBlock(field, suffix, choices) {
    const col = document.createElement('div');
    col.className = 'col md-3 mt-2';

    const labelWrap = document.createElement('b');
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = field.label;
    labelWrap.appendChild(label);

    const helpLink = document.createElement('a');
    helpLink.href = `help.html#${field.helpId}`;
    helpLink.target = '_blank';
    helpLink.className = 'ms-1 text-decoration-none';
    helpLink.innerHTML = '<i class="bi bi-question-circle"></i>';

    const repeatable = document.createElement('div');
    const key = `${field.id}_${suffix}`;
    repeatable.id = `repeatable-${key}`;
    createRepeatableField(repeatable, key, choices[field.id] || [], field.id);

    col.appendChild(labelWrap);
    col.appendChild(helpLink);
    col.appendChild(repeatable);

    return col;
  }

  function buildSection(container, title, suffix, choices) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    container.appendChild(heading);

    for (let i = 0; i < FIELD_SPECS.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'row justify-content-around';

      row.appendChild(buildFieldBlock(FIELD_SPECS[i], suffix, choices));
      if (FIELD_SPECS[i + 1]) {
        const second = buildFieldBlock(FIELD_SPECS[i + 1], suffix, choices);
        second.className = 'col offset-md-1 mt-2';
        row.appendChild(second);
      }

      container.appendChild(row);
    }
  }

  function collectDynamicField(form, key) {
    const values = [];
    let i = 0;

    while (true) {
      const select = form.querySelector(`[name="${key}_${i}"]`);
      if (!select) break;

      if (select.tagName !== 'SELECT') {
        const directValue = select.value.trim();
        if (directValue) values.push(directValue);
        i += 1;
        continue;
      }

      if (select.value === 'other') {
        const custom = form.querySelector(`[name="${key}_other_${i}"]`);
        const customValue = custom ? custom.value.trim() : '';
        if (customValue) values.push(customValue);
      } else if (select.value) {
        values.push(select.value);
      }

      i += 1;
    }

    return Array.from(new Set(values));
  }

  function stringifyScalar(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  function stringifyList(values, indent) {
    if (!values.length) return '[]';
    return `\n${values.map((v) => `${indent}- ${stringifyScalar(v)}`).join('\n')}`;
  }

  function buildYaml(formData) {
    const lines = [];
    lines.push(`name: ${stringifyScalar(formData.name)}`);

    lines.push('include_values:');
    let includeCount = 0;
    INCLUDE_KEYS.forEach((key) => {
      const values = formData[key] || [];
      if (values.length) {
        lines.push(`  ${TRANSLATE_KEY[key]}:${stringifyList(values, '    ')}`);
        includeCount += 1;
      }
    });
    if (!includeCount) lines.push('  {}');

    lines.push('exclude_values:');
    let excludeCount = 0;
    EXCLUDE_KEYS.forEach((key) => {
      const values = formData[key] || [];
      if (values.length) {
        lines.push(`  ${TRANSLATE_KEY[key]}:${stringifyList(values, '    ')}`);
        excludeCount += 1;
      }
    });
    if (!excludeCount) lines.push('  {}');

    return lines.join('\n') + '\n';
  }

  function saveFormDataFromIndex() {
    const form = document.getElementById('filtrationForm');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      const nameInput = document.getElementById('id_name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        if (nameInput) nameInput.focus();
        return;
      }

      const formData = { name };
      FIELD_SPECS.forEach((field) => {
        formData[`${field.id}_incl`] = collectDynamicField(form, `${field.id}_incl`);
        formData[`${field.id}_excl`] = collectDynamicField(form, `${field.id}_excl`);
      });

      sessionStorage.setItem('filter_form_data', JSON.stringify(formData));
      window.location.href = 'download.html';
    });
  }

  function setupDownloadPage() {
    const button = document.getElementById('downloadYamlButton');
    if (!button) return;

    const errorBox = document.getElementById('downloadError');

    button.addEventListener('click', function () {
      const raw = sessionStorage.getItem('filter_form_data');
      if (!raw) {
        if (errorBox) {
          errorBox.textContent = 'No submitted form data was found. Please create the filtration setup first.';
          errorBox.style.display = 'block';
        }
        return;
      }

      let formData;
      try {
        formData = JSON.parse(raw);
      } catch (error) {
        if (errorBox) {
          errorBox.textContent = 'Stored form data is invalid. Please submit the form again.';
          errorBox.style.display = 'block';
        }
        return;
      }

      const safeName = (formData.name || 'filter').trim() || 'filter';
      const yamlText = buildYaml(formData);
      const blob = new Blob([yamlText], { type: 'application/x-yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeName}.yaml`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      if (errorBox) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
      }
    });
  }

  async function setupIndexPage() {
    const includeSection = document.getElementById('include-section');
    const excludeSection = document.getElementById('exclude-section');
    const errorBox = document.getElementById('formLoadError');
    if (!includeSection || !excludeSection) return;

    try {
      const choices = await loadChoices();
      buildSection(includeSection, 'Values to be included', 'incl', choices);
      buildSection(excludeSection, 'Values to be excluded', 'excl', choices);
      saveFormDataFromIndex();
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = `Could not load the form data files. ${error.message}`;
        errorBox.style.display = 'block';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupIndexPage();
    setupDownloadPage();
  });
})();
