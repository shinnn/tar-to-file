'use strict';

const {join} = require('path');
const {createGunzip} = require('zlib');

const readUtf8File = require('read-utf8-file');
const rmfr = require('rmfr');
const tarToFile = require('..');
const test = require('tape');

test('tarToFile()', async t => {
	t.plan(24);

	const tmp = join(__dirname, 'tmp');

	await rmfr(tmp);

	tarToFile(join(__dirname, 'fixture-single-file.tar'), join(tmp, '__file__.txt')).subscribe({
		next(progress) {
			if (progress.bytes === 0) {
				t.equal(
					progress.header.name,
					'__file__.txt',
					'should send file metadata.'
				);

				return;
			}

			t.equal(
				progress.bytes,
				progress.header.size,
				'should send compression progress.'
			);
		},
		error: t.fail,
		async complete() {
			t.equal(
				await readUtf8File(join(tmp, '__file__.txt')),
				'🐡\n',
				'should extract a tar archive.'
			);
		}
	});

	const subscription = tarToFile(join(__dirname, 'fixture-single-file.tar'), join(tmp, 'original.txt'), {
		map(header) {
			header.name = header.name.replace('original', 'renamed');
			subscription.unsubscribe();
			return header;
		}
	}).subscribe({error: t.fail});

	setTimeout(async () => {
		t.equal(
			await readUtf8File(join(tmp, 'renamed.txt')),
			'',
			'should be cancelable.'
		);
	}, 100);

	const fail = t.fail.bind(t, 'Unexpectedly completed.');

	tarToFile(join(__dirname, 'fixture-two-files.tgz'), join(tmp, 'two'), {
		tarTransform: createGunzip()
	}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				`Error: Expected the archive ${
					join(__dirname, 'fixture-two-files.tgz')
				} to contain only a single file, but actually contains multiple entries 'a.txt' and 'b.txt'.`,
				'should fail when the tar contains multiple entries.'
			);
		},
		complete: fail
	});

	tarToFile(join(__dirname, 'fixture-directory.tar'), join(tmp, 'dir', 'dir')).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				`Error: Expected the archive ${
					join(__dirname, 'fixture-directory.tar')
				} to contain only a single file, but actually contains a non-file entry '_' (directory).`,
				'should fail when the tar contains a non-file entry.'
			);
		},
		complete: fail
	});

	tarToFile(join(__dirname, 'fixture-single-file.tar'), __dirname).subscribe({
		error({code}) {
			t.equal(
				code,
				'EISDIR',
				'should fail when it cannot write a file.'
			);
		},
		complete: fail
	});

	tarToFile(join(__dirname, 'fixture-single-file.tar'), join(__filename, '_')).subscribe({
		error({code}) {
			t.equal(
				code,
				'EEXIST',
				'should fail when it cannot create a directory.'
			);
		},
		complete: fail
	});

	tarToFile('none', 'dest').subscribe({
		error({code}) {
			t.equal(
				code,
				'ENOENT',
				'should fail when the tar file doesn\'t exists.'
			);
		},
		complete: fail
	});

	tarToFile(__dirname, join(tmp, '._')).subscribe({
		error({code}) {
			t.equal(
				code,
				'EISDIR',
				'should fail when the source is a directory.'
			);
		},
		complete: fail
	});

	tarToFile(__filename, '.').subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'Error: Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?',
				'should fail when the source is not a tar file.'
			);
		},
		complete: fail
	});

	tarToFile().subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'RangeError: Expected 2 or 3 arguments (<string>, <string>[, <Object>]), but got no arguments instead.',
				'should fail when it takes no arguments.'
			);
		},
		complete: fail
	});

	tarToFile('a', 'b', 'c', 'd').subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'RangeError: Expected 2 or 3 arguments (<string>, <string>[, <Object>]), but got 4 arguments instead.',
				'should fail when it takes too many arguments.'
			);
		},
		complete: fail
	});

	tarToFile(1, 'a').subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: Expected a path of a tar archive (string), but got 1 (number).',
				'should fail when the file path is not a string.'
			);
		},
		complete: fail
	});

	tarToFile('', 'a').subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'Error: Expected a path of a tar archive, but got \'\' (empty string).',
				'should fail when the file path is an empty string.'
			);
		},
		complete: fail
	});

	tarToFile('a', true).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: Expected a destination file path (string), but got true (boolean).',
				'should fail when the tar path is not a string.'
			);
		},
		complete: fail
	});

	tarToFile('a', '').subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'Error: Expected a destination file path, but got \'\' (empty string).',
				'should fail when the tar path is an empty string.'
			);
		},
		complete: fail
	});

	tarToFile('a', 'b', /c/).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: Expected an object to specify `tar-to-file` options, but got /c/ (regexp).',
				'should fail when the third argument is not a plain object.'
			);
		},
		complete: fail
	});

	tarToFile('a', 'b', {entries: 1}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: `tar-to-file` doesn\'t support `entries` option , but 1 (number) was provided to it.',
				'should fail when it takes an unsupported option.'
			);
		},
		complete: fail
	});

	tarToFile('a', 'b', {map: new WeakSet()}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: `map` option must be a function, but WeakSet {} was provided to it.',
				'should fail when it takes an invalid-type option.'
			);
		},
		complete: fail
	});

	tarToFile('a', 'b', {tarTransform: Symbol('c')}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: `tarTransform` option must be a transform stream ' +
        'that modifies the tar archive before extraction, but got a non-stream value Symbol(c).',
				'should fail when it takes a non-stream `tarTransform` option.'
			);
		},
		complete: fail
	});

	tarToFile('a', 'b', {tarTransform: process.stdout}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: `tarTransform` option must be a transform stream that modifies ' +
        'the tar archive before extraction, but got a writable stream instead.',
				'should fail when it takes an unreadable `tarTransform` option.'
			);
		},
		complete: fail
	});

	tarToFile(join(__dirname, 'fixture-single-file.tar'), join(tmp, '_'), {
		mapStream() {
			return Buffer.from('a');
		}
	}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: The function passed to `mapStream` option must return a stream, ' +
        'but returned a non-stream value <Buffer 61>.',
				'should fail when `mapStream` function returns a non-stream value.'
			);
		},
		complete: fail
	});

	tarToFile(join(__dirname, 'fixture-single-file.tar'), join(tmp, '_'), {
		mapStream() {
			return process.stdout;
		}
	}).subscribe({
		error(err) {
			t.equal(
				err.toString(),
				'TypeError: The function passed to `mapStream` option ' +
        'must return a stream that is readable, but returned a non-readable stream.',
				'should fail when it takes a unreadable `tarTransform` option.'
			);
		},
		complete: fail
	});
});

