import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Input from '../../components/Input';

jest.mock('@unform/core', () => {
  return {
    useField() {
      return {
        fieldName: 'email',
        defaultValue: '',
        error: '',
        registerField: jest.fn(),
      };
    },
  };
});

describe('Input component', () => {
  it('should be able to render an input', () => {
    const { getByPlaceholderText } = render(
      <Input name="email" placeholder="Email" />,
    );

    expect(getByPlaceholderText('Email')).toBeTruthy();
  });

  it('should highlight the input on focus', async () => {
    const { getByPlaceholderText, getByTestId } = render(
      <Input name="email" placeholder="Email" />,
    );

    const inputElement = getByPlaceholderText('Email');
    const containerElement = getByTestId('input-container');

    fireEvent.focus(inputElement);

    await waitFor(() => {
      expect(containerElement.className).toMatch(/border-\[var\(--color-primary\)\]/);
      expect(containerElement.className).toMatch(/text-\[var\(--color-primary\)\]/);
    });
  });

  it('should not highlight the input when on blur', async () => {
    const { getByPlaceholderText, getByTestId } = render(
      <Input name="email" placeholder="Email" />,
    );

    const inputElement = getByPlaceholderText('Email');
    const containerElement = getByTestId('input-container');

    fireEvent.blur(inputElement);

    await waitFor(() => {
      expect(containerElement.className).not.toMatch(/border-\[var\(--color-primary\)\]/);
      expect(containerElement.className).not.toMatch(/text-\[var\(--color-primary\)\]/);
      expect(containerElement.className).toMatch(/text-\[var\(--color-hard-gray\)\]/);
    });
  });

  it('should keep input border highlighted when field is filled', async () => {
    const { getByPlaceholderText, getByTestId } = render(
      <Input name="email" placeholder="Email" />,
    );

    const inputElement = getByPlaceholderText('Email');
    const containerElement = getByTestId('input-container');

    fireEvent.change(inputElement, {
      target: { value: 'johndoe@example.com' },
    });
    fireEvent.blur(inputElement);

    await waitFor(() => {
      expect(containerElement.className).toMatch(/text-\[var\(--color-primary\)\]/);
    });
  });
});
